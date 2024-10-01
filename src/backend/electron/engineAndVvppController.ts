import log from "electron-log/main";
import { BrowserWindow, dialog } from "electron";

import EngineInfoManager from "./manager/engineInfoManager";
import EngineProcessManager from "./manager/engineProcessManager";
import VvppManager from "./manager/vvppManager";
import { RuntimeInfoManager } from "./manager/RuntimeInfoManager";
import { ElectronConfigManager } from "./electronConfig";
import {
  EngineId,
  EngineInfo,
  engineSettingSchema,
  EngineSettingType,
} from "@/type/preload";

/**
 * エンジンとVVPP周りの処理の流れを制御するクラス。
 */
export class EngineAndVvppController {
  constructor(
    private runtimeInfoManager: RuntimeInfoManager,
    private configManager: ElectronConfigManager,
    private engineInfoManager: EngineInfoManager,
    private engineProcessManager: EngineProcessManager,
    private vvppManager: VvppManager,
  ) {}

  /**
   * VVPPエンジンをインストールする。
   */
  async installVvppEngine(vvppPath: string) {
    try {
      await this.vvppManager.install(vvppPath);
      return true;
    } catch (e) {
      dialog.showErrorBox(
        "インストールエラー",
        `${vvppPath} をインストールできませんでした。`,
      );
      log.error(`Failed to install ${vvppPath},`, e);
      return false;
    }
  }

  /**
   * 危険性を案内してからVVPPエンジンをインストールする。
   * FIXME: こちらで案内せず、GUIでのインストール側に合流させる
   */
  async installVvppEngineWithWarning({
    vvppPath,
    reloadNeeded,
    reloadCallback,
    win,
  }: {
    vvppPath: string;
    reloadNeeded: boolean;
    reloadCallback?: () => void; // 再読み込みが必要な場合のコールバック
    win: BrowserWindow; // dialog表示に必要。 FIXME: dialog表示関数をDI可能にし、winを削除する
  }) {
    const result = dialog.showMessageBoxSync(win, {
      type: "warning",
      title: "エンジン追加の確認",
      message: `この操作はコンピュータに損害を与える可能性があります。エンジンの配布元が信頼できない場合は追加しないでください。`,
      buttons: ["追加", "キャンセル"],
      noLink: true,
      cancelId: 1,
    });
    if (result == 1) {
      return;
    }

    await this.installVvppEngine(vvppPath);

    if (reloadNeeded) {
      void dialog
        .showMessageBox(win, {
          type: "info",
          title: "再読み込みが必要です",
          message:
            "VVPPファイルを読み込みました。反映には再読み込みが必要です。今すぐ再読み込みしますか？",
          buttons: ["再読み込み", "キャンセル"],
          noLink: true,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            reloadCallback?.();
          }
        });
    }
  }

  /**
   * VVPPエンジンをアンインストールする。
   * 関数を呼んだタイミングでアンインストール処理を途中まで行い、アプリ終了時に完遂する。
   */
  async uninstallVvppEngine(engineId: EngineId) {
    let engineInfo: EngineInfo | undefined = undefined;
    try {
      engineInfo = this.engineInfoManager.fetchEngineInfo(engineId);
      if (!engineInfo) {
        throw new Error(
          `No such engineInfo registered: engineId == ${engineId}`,
        );
      }

      if (!this.vvppManager.canUninstall(engineInfo)) {
        throw new Error(`Cannot uninstall: engineId == ${engineId}`);
      }

      // Windows環境だとエンジンを終了してから削除する必要がある。
      // そのため、アプリの終了時に削除するようにする。
      this.vvppManager.markWillDelete(engineId);
      return true;
    } catch (e) {
      const engineName = engineInfo?.name ?? engineId;
      dialog.showErrorBox(
        "アンインストールエラー",
        `${engineName} をアンインストールできませんでした。`,
      );
      log.error(`Failed to uninstall ${engineId},`, e);
      return false;
    }
  }

  /** エンジンの設定を更新し、保存する */
  updateEngineSetting(engineId: EngineId, engineSetting: EngineSettingType) {
    const engineSettings = this.configManager.get("engineSettings");
    engineSettings[engineId] = engineSetting;
    this.configManager.set(`engineSettings`, engineSettings);
  }

  // エンジンの準備と起動
  async launchEngines() {
    // AltPortInfosを再生成する。
    this.engineInfoManager.initializeAltPortInfo();

    // TODO: デフォルトエンジンの処理をConfigManagerに移してブラウザ版と共通化する
    const engineInfos = this.engineInfoManager.fetchEngineInfos();
    const engineSettings = this.configManager.get("engineSettings");
    for (const engineInfo of engineInfos) {
      if (!engineSettings[engineInfo.uuid]) {
        // 空オブジェクトをパースさせることで、デフォルト値を取得する
        engineSettings[engineInfo.uuid] = engineSettingSchema.parse({});
      }
    }
    this.configManager.set("engineSettings", engineSettings);

    await this.engineProcessManager.runEngineAll();
    this.runtimeInfoManager.setEngineInfos(engineInfos);
    await this.runtimeInfoManager.exportFile();
  }

  /**
   * エンジンを再起動する。
   * エンジンの起動が開始したらresolve、起動が失敗したらreject。
   */
  async restartEngines(engineId: EngineId) {
    await this.engineProcessManager.restartEngine(engineId);

    // ランタイム情報の更新
    // TODO: setからexportの処理は排他処理にしたほうがより良い
    this.runtimeInfoManager.setEngineInfos(
      this.engineInfoManager.fetchEngineInfos(),
    );
    await this.runtimeInfoManager.exportFile();
  }

  /**
   * エンジンの停止とエンジン終了後処理を行う。
   * 全処理が完了済みの場合 alreadyCompleted を返す。
   * そうでない場合は Promise を返す。
   */
  cleanupEngines(): Promise<void> | "alreadyCompleted" {
    const killingProcessPromises = this.engineProcessManager.killEngineAll();
    const numLivingEngineProcess = Object.entries(
      killingProcessPromises,
    ).length;

    // 前処理が完了している場合
    if (
      numLivingEngineProcess === 0 &&
      !this.vvppManager.hasMarkedEngineDirs()
    ) {
      return "alreadyCompleted";
    }

    let numEngineProcessKilled = 0;

    // 非同期的にすべてのエンジンプロセスをキル
    const waitingKilledPromises: Promise<void>[] = Object.entries(
      killingProcessPromises,
    ).map(([engineId, promise]) => {
      return promise
        .catch((error) => {
          // TODO: 各エンジンプロセスキルの失敗をUIに通知する
          log.error(
            `ENGINE ${engineId}: Error during killing process: ${error}`,
          );
          // エディタを終了するため、エラーが起きてもエンジンプロセスをキルできたとみなす
        })
        .finally(() => {
          numEngineProcessKilled++;
          log.info(
            `ENGINE ${engineId}: Process killed. ${numEngineProcessKilled} / ${numLivingEngineProcess} processes killed`,
          );
        });
    });

    // すべてのエンジンプロセスキル処理が完了するまで待機
    return Promise.all(waitingKilledPromises).then(() => {
      // エンジン終了後の処理を実行
      log.info(
        "All ENGINE process kill operations done. Running post engine kill process",
      );
      return this.vvppManager.handleMarkedEngineDirs();
    });
  }

  /**
   * 安全なシャットダウン処理。
   * この関数内の処理はelectronの終了シーケンスに合わせ、非同期処理が必要かどうかを判定したあとで非同期処理を実行する必要がある。
   * FIXME: 判定用の関数と非同期処理関数を分離すれば仕様が簡潔になる。
   */
  gracefulShutdown() {
    const engineCleanupResult = this.cleanupEngines();
    const configSavedResult = this.configManager.ensureSaved();
    return { engineCleanupResult, configSavedResult };
  }
}
