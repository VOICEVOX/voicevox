import { dialog } from "electron";

import semver from "semver";
import { getConfigManager } from "./electronConfig";
import { getEngineInfoManager } from "./manager/engineInfoManager";
import { getEngineProcessManager } from "./manager/engineProcessManager";
import { getRuntimeInfoManager } from "./manager/RuntimeInfoManager";
import { getVvppManager } from "./manager/vvppManager";
import { getWindowManager } from "./manager/windowManager";
import { MultiDownloader } from "./multiDownloader";
import { EngineId, EngineInfo, engineSettingSchema } from "@/type/preload";
import {
  PackageInfo,
  fetchLatestDefaultEngineInfo,
  getSuitablePackageInfo,
} from "@/domain/defaultEngine/latetDefaultEngine";
import { loadEnvEngineInfos } from "@/domain/defaultEngine/envEngineInfo";
import { UnreachableError } from "@/type/utility";
import { ProgressCallback } from "@/helpers/progressHelper";
import { createLogger } from "@/helpers/log";
import { DisplayableError, errorToMessage } from "@/helpers/errorHelper";

const log = createLogger("EngineAndVvppController");

/** エンジンパッケージの状態 */
export type EnginePackageStatus = {
  package: {
    engineName: string;
    engineId: EngineId;
    packageInfo: PackageInfo;
    latestVersion: string;
  };
  installed:
    | { status: "notInstalled" }
    | { status: "outdated" | "latest"; installedVersion: string };
};

/**
 * エンジンとVVPP周りの処理の流れを制御するクラス。
 */
export class EngineAndVvppController {
  private get configManager() {
    return getConfigManager();
  }
  private get engineInfoManager() {
    return getEngineInfoManager();
  }
  private get engineProcessManager() {
    return getEngineProcessManager();
  }
  private get runtimeInfoManager() {
    return getRuntimeInfoManager();
  }
  private get vvppManager() {
    return getVvppManager();
  }

  /**
   * VVPPエンジンをインストールする。
   * 失敗した場合は例外を投げる。
   *
   * @param asDefaultVvppEngine デフォルトエンジンとしてインストールするかどうか。デフォルトエンジン上書きを防ぐ目的で実装している。
   */
  async installVvppEngine(params: {
    vvppPath: string;
    asDefaultVvppEngine: boolean;
    immediate: boolean;
    callbacks?: { onProgress?: ProgressCallback };
  }) {
    const { vvppPath, asDefaultVvppEngine, immediate, callbacks } = params;

    try {
      const extractedEngineFiles = await this.vvppManager.extract(
        vvppPath,
        callbacks,
      );

      const isDefaultEngine = this.engineInfoManager.isDefaultEngine(
        extractedEngineFiles.getManifest().uuid,
      );
      if (asDefaultVvppEngine && !isDefaultEngine) {
        throw new DisplayableError("これはデフォルトエンジンではありません。");
      }
      if (!asDefaultVvppEngine && isDefaultEngine) {
        throw new DisplayableError(
          "デフォルトエンジンと同じエンジンはインストールできません。",
        );
      }

      await this.vvppManager.install({ extractedEngineFiles, immediate });
    } catch (e) {
      throw new DisplayableError(
        `${vvppPath} をインストールできませんでした。`,
        { cause: e },
      );
    }
  }

  /**
   * 危険性を案内してからVVPPエンジンをインストールする。
   * FIXME: こちらで案内せず、GUIでのインストール側に合流させる
   */
  async installVvppEngineWithWarning({
    vvppPath,
    asDefaultVvppEngine,
    reloadNeeded,
    reloadCallback,
  }: {
    vvppPath: string;
    asDefaultVvppEngine: boolean;
    reloadNeeded: boolean;
    reloadCallback?: () => void; // 再読み込みが必要な場合のコールバック
  }) {
    const windowManager = getWindowManager();
    const result = windowManager.showMessageBoxSync({
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

    try {
      await this.installVvppEngine({
        vvppPath,
        asDefaultVvppEngine,
        immediate: false,
      });
    } catch (e) {
      log.error(e);
      dialog.showErrorBox("インストールエラー", errorToMessage(e));
      return;
    }

    if (reloadNeeded) {
      void windowManager
        .showMessageBox({
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
   * 失敗した場合は例外を投げる。
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
    } catch (e) {
      throw new DisplayableError(
        `${engineId} をアンインストールできませんでした。`,
        { cause: e },
      );
    }
  }

  /**
   * 最新のエンジンパッケージの情報や、そのエンジンのインストール状況を取得する。
   */
  async fetchEnginePackageStatuses(): Promise<EnginePackageStatus[]> {
    const statuses: EnginePackageStatus[] = [];

    for (const envEngineInfo of loadEnvEngineInfos()) {
      if (envEngineInfo.type != "downloadVvpp") {
        continue;
      }

      // 最新情報を取得
      const latestUrl = envEngineInfo.latestUrl;
      if (latestUrl == undefined) throw new Error("latestUrl is undefined");

      const latestInfo = await fetchLatestDefaultEngineInfo(latestUrl);
      if (latestInfo.formatVersion != 1) {
        log.error(`Unsupported format version: ${latestInfo.formatVersion}`);
        continue;
      }

      // 実行環境に合うパッケージを取得
      const packageInfo = getSuitablePackageInfo(latestInfo);
      log.info(`Latest default engine version: ${packageInfo.version}`);

      // インストール状況を取得
      let installedStatus: EnginePackageStatus["installed"];
      const isInstalled = this.engineInfoManager.hasEngineInfo(
        envEngineInfo.uuid,
      );
      if (!isInstalled) {
        installedStatus = { status: "notInstalled" };
      } else {
        const installedEngineInfo = this.engineInfoManager.fetchEngineInfo(
          envEngineInfo.uuid,
        );
        const installedVersion = installedEngineInfo.version;
        installedStatus = {
          status: semver.lt(installedVersion, packageInfo.version)
            ? "outdated"
            : "latest",
          installedVersion,
        };
      }

      statuses.push({
        package: {
          engineName: envEngineInfo.name,
          engineId: envEngineInfo.uuid,
          packageInfo,
          latestVersion: packageInfo.version,
        },
        installed: installedStatus,
      });
    }

    return statuses;
  }

  /** VVPPパッケージをダウンロードし、インストールする */
  async downloadAndInstallVvppEngine(
    downloadDir: string,
    packageInfo: PackageInfo,
    callbacks: { onProgress: ProgressCallback<"download" | "install"> },
  ) {
    if (packageInfo.packages.length === 0) {
      throw new UnreachableError("No packages to download");
    }

    await using downloader = new MultiDownloader(
      downloadDir,
      packageInfo.packages,
      {
        onProgress: ({ progress }) => {
          callbacks.onProgress({ type: "download", progress });
        },
      },
    );
    await downloader.download();

    // インストール
    await this.installVvppEngine({
      vvppPath: downloader.downloadedPaths[0],
      asDefaultVvppEngine: true,
      immediate: true,
      callbacks: {
        onProgress: ({ progress }) => {
          callbacks.onProgress({ type: "install", progress });
        },
      },
    });
  }

  /** 各エンジンの設定を初期化する */
  private initializeEngineSettings() {
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
  }

  // エンジンの準備と起動
  async launchEngines() {
    // AltPortInfosを再生成する。
    this.engineInfoManager.initializeAltPortInfo();

    this.initializeEngineSettings();

    const engineInfos = this.engineInfoManager.fetchEngineInfos();
    await this.engineProcessManager.runEngineAll();
    this.runtimeInfoManager.setEngineInfos(
      engineInfos,
      this.engineInfoManager.altPortInfos,
    );
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
      this.engineInfoManager.altPortInfos,
    );
    await this.runtimeInfoManager.exportFile();
  }

  /**
   * エンジンの停止とエンジン終了後処理を行う。
   */
  async cleanupEngines(): Promise<void> {
    const killingProcessPromises = this.engineProcessManager.killEngineAll();
    const numLivingEngineProcess = Object.entries(
      killingProcessPromises,
    ).length;

    // 前処理が完了している場合
    if (
      numLivingEngineProcess === 0 &&
      !this.vvppManager.hasMarkedEngineDirs()
    ) {
      return;
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
      // FIXME: handleMarkedEngineDirsはエラーをthrowしている。エラーがthrowされるとアプリが終了しないので、終了するようにしたい。
      return this.vvppManager.handleMarkedEngineDirs();
    });
  }
}

let manager: EngineAndVvppController | undefined;

export function getEngineAndVvppController() {
  if (manager == undefined) {
    manager = new EngineAndVvppController();
  }
  return manager;
}
