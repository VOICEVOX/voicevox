/**
 * サードパーティ向けのランタイム情報を書き出す。
 * ランタイム情報には起動しているエンジンのURLなどが含まれる。
 */

import fs from "fs";
import AsyncLock from "async-lock";
import log from "electron-log/main";
import { EngineId, EngineInfo } from "@/type/preload";

/**
 * ランタイム情報書き出しに必要なEngineInfo
 */
export type EngineInfoForRuntimeInfo = Pick<
  EngineInfo,
  "uuid" | "host" | "name"
>;

/**
 * 保存されるランタイム情報
 */
type RuntimeInfo = {
  formatVersion: number;
  appVersion: string;
  engineInfos: {
    uuid: EngineId;
    url: string;
    name: string;
  }[];
};

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
   * ファイルフォーマットバージョン
   */
  private fileFormatVersion = 1;

  /**
   * エンジン情報（書き出し用に記憶）
   */
  private engineInfos: EngineInfoForRuntimeInfo[] = [];

  /**
   * エンジン情報を登録する
   */
  public setEngineInfos(engineInfos: EngineInfoForRuntimeInfo[]) {
    this.engineInfos = engineInfos;
  }

  /**
   * ランタイム情報ファイルを書き出す
   */
  public async exportFile() {
    await this.lock.acquire(this.lockKey, async () => {
      // データ化
      const runtimeInfoFormatFor3rdParty: RuntimeInfo = {
        formatVersion: this.fileFormatVersion,
        appVersion: this.appVersion,
        engineInfos: this.engineInfos.map((engineInfo) => {
          return {
            uuid: engineInfo.uuid,
            url: engineInfo.host, // NOTE: 元のEngineInfo.hostにURLが入っている
            name: engineInfo.name,
          };
        }),
      };

      // ファイル書き出し
      try {
        await fs.promises.writeFile(
          this.runtimeInfoPath,
          JSON.stringify(runtimeInfoFormatFor3rdParty), // FIXME: zod化する
        );
        log.info(
          `Runtime information file has been updated. : ${this.runtimeInfoPath}`,
        );
      } catch (e) {
        // ディスクの空き容量がない、他ツールからのファイルロック時をトラップ。
        // サードパーティ向けなのでVOICEVOX側には通知せず、エラー記録して継続
        log.error(`Failed to write file : ${e}`);
      }
    });
  }
}
