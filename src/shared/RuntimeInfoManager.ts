/**
 * サードパーティ向けのランタイム情報を書き出す。
 * ランタイム情報には起動しているエンジンのURLなどが含まれる。
 */

import fs from "fs";
import AsyncLock from "async-lock";
import log from "electron-log/main";
import { EngineId, EngineInfo } from "@/type/preload";

/**
 * ランタイム情報内のエンジン情報
 * Note:変更時はRuntimeInfoManager.fileFormatVersionも変更すること
 */
export interface EngineInfoForRuntimeInfo {
  uuid: EngineId;
  url: string;
  name: string;
}

/**
 * 保存されるランタイム情報
 * Note:変更時はRuntimeInfoManager.fileFormatVersionも変更すること
 */
interface RuntimeInfo {
  formatVersion: number;
  appVersion: string;
  engineInfos: EngineInfoForRuntimeInfo[];
}

/**
 * サードパーティ向けのランタイム情報を書き出す
 */
export class RuntimeInfoManager {
  private runtimeInfoPath: string;
  private appVersion: string;

  constructor(runtimeInfoPath: string, appVersion: string) {
    this.runtimeInfoPath = runtimeInfoPath;
    this.appVersion = appVersion;
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
   * ランタイム情報ファイルを書き出す
   */
  public async exportFile() {
    await this.lock.acquire(this.lockKey, async () => {
      log.info(
        `Runtime information file has been updated. : ${this.runtimeInfoPath}`
      );

      // データ化
      const engineInfos: EngineInfoForRuntimeInfo[] = this.engineInfos.map(
        (engineInfo) => {
          return {
            uuid: engineInfo.uuid,
            url: engineInfo.host,
            name: engineInfo.name,
          };
        }
      );
      const runtimeInfoFormatFor3rdParty: RuntimeInfo = {
        formatVersion: this.fileFormatVersion,
        appVersion: this.appVersion,
        engineInfos,
      };

      // ファイル書き出し
      try {
        await fs.promises.writeFile(
          this.runtimeInfoPath,
          JSON.stringify(runtimeInfoFormatFor3rdParty)
        );
      } catch (e) {
        // ディスクの空き容量がない、他ツールからのファイルロック時をトラップ。
        // サードパーティ向けなのでVOICEVOX側には通知せず、エラー記録して継続
        log.error(`Failed to write file : ${e}`);
      }
    });
  }
}
