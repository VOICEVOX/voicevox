import fs from "fs";
import AsyncLock from "async-lock";
import log from "electron-log/main";
import { EngineId, EngineInfo } from "@/type/preload";

/**
 * サードパーティ向けランタイム情報のエクスポート情報クラス
 */
export class RuntimeInfoManager {
  private runtimeInfoPath: string;
  private appVersion: string;

  constructor(userDataPath: string, appVersion: string) {
    this.runtimeInfoPath = userDataPath;
    this.appVersion = appVersion;
  }

  /**
   * サードパーティ向けランタイム情報のファイルパスを取得する
   */
  public getRuntimeInfoPath(): string {
    return this.runtimeInfoPath;
  }

  /**
   * ファイルロック用のインスタンス
   */
  private lock = new AsyncLock({
    timeout: 1000,
  });
  private lockKey = "write";

  /**
   * サードパーティ向けランタイム情報のフォーマットバージョン
   * Note: 破壊的変更があった場合に数字を上げること
   */
  private fileFormatVersion = 1;

  /**
   * エンジン情報（書き出し用に記憶）
   */
  private engineInfos: EngineInfo[] = [];

  /**
   * エンジン情報を登録する
   */
  public setEngineInfos(engineInfos: EngineInfo[]) {
    this.engineInfos = engineInfos;
  }

  /**
   * サードパーティ向けの設定ファイルを書き出す
   */
  public async exportFile() {
    await this.lock.acquire(this.lockKey, async () => {
      log.info(
        `Runtime information file has been updated. : ${this.runtimeInfoPath}`
      );

      const outputInfoData = new OutputInfoDataFor3rdParty(
        this.appVersion,
        this.fileFormatVersion
      );

      // ファイルに書き出すデータをつくる
      try {
        await fs.promises.writeFile(
          this.runtimeInfoPath,
          JSON.stringify(outputInfoData.getOutputInfoData(this.engineInfos))
        );
      } catch (e) {
        // ディスクの空き容量がない、他ツールからのファイルロック時をトラップ。
        // サードパーティ向けなのでVOICEVOX側には通知せず、エラー記録して継続
        log.error(`Failed to write file : ${e}`);
      }
    });
  }
}

/**
 * サードパーティ向けエンジン情報のレコード定義
 * Note:変更時はRuntimeInfoManager.fileFormatVersionも変更すること
 */
export interface EngineInfoRecordFor3rdParty {
  uuid: EngineId;
  url: string;
  name: string;
}

/**
 * サードパーティ向けランタイム情報のレコード定義
 * Note:変更時はRuntimeInfoManager.fileFormatVersionも変更すること
 */
export interface RuntimeInfoFormatFor3rdParty {
  formatVersion: number;
  appVersion: string;
  engineInfos: EngineInfoRecordFor3rdParty[];
}

/**
 * サードパーティ向けランタイム情報のエクスポートフォーマットクラス
 */
export class OutputInfoDataFor3rdParty {
  private appVersion: string;
  private fileFormatVersion: number;

  constructor(appVersion: string, fileFormatVersion: number) {
    this.appVersion = appVersion;
    this.fileFormatVersion = fileFormatVersion;
  }

  /**
   * サードパーティ向けに提供するデータを取得
   */
  public getOutputInfoData(
    engineInfos: EngineInfo[]
  ): RuntimeInfoFormatFor3rdParty {
    const engineInfoList: EngineInfoRecordFor3rdParty[] = engineInfos.map(
      (engineInfo) => {
        return {
          uuid: engineInfo.uuid,
          url: engineInfo.host,
          name: engineInfo.name,
        };
      }
    );

    const engineInfoFormatFor3rdParty: RuntimeInfoFormatFor3rdParty = {
      formatVersion: this.fileFormatVersion,
      appVersion: this.appVersion,
      engineInfos: engineInfoList,
    };

    return engineInfoFormatFor3rdParty;
  }
}
