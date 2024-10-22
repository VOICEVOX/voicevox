/**
 * サードパーティ向けのランタイム情報を書き出す。
 * ランタイム情報には起動しているエンジンのURLなどが含まれる。
 */

import AsyncLock from "async-lock";
import log from "electron-log/main";
import type { AltPortInfos } from "@/store/type";
import { EngineId, EngineInfo } from "@/type/preload";
import { writeFileSafely } from "@/helpers/fileHelper";

/**
 * ランタイム情報書き出しに必要なEngineInfo
 */
export type EngineInfoForRuntimeInfo = Pick<
  EngineInfo,
  "uuid" | "protocol" | "hostname" | "defaultPort" | "pathname" | "name"
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
  private altportInfos: AltPortInfos = {};

  /**
   * エンジン情報を登録する
   */
  public setEngineInfos(
    engineInfos: EngineInfoForRuntimeInfo[],
    altportInfos: AltPortInfos,
  ) {
    this.engineInfos = engineInfos;
    this.altportInfos = altportInfos;
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
          const altPort: string | undefined =
            this.altportInfos[engineInfo.uuid];
          const port = altPort ?? engineInfo.defaultPort;
          // NOTE: URLを正規化する
          const url = new URL(`${engineInfo.protocol}//${engineInfo.hostname}`);
          url.port = port;
          return {
            uuid: engineInfo.uuid,
            // NOTE: URLインターフェースは"pathname"が空文字でも"/"を付けるので手動で結合する。
            url: `${url.origin}${engineInfo.pathname}`,
            name: engineInfo.name,
          };
        }),
      };

      // ファイル書き出し
      try {
        await writeFileSafely(
          this.runtimeInfoPath,
          JSON.stringify(runtimeInfoFormatFor3rdParty), // FIXME: zod化する
        );
        log.info(
          `Runtime information file has been updated. : ${this.runtimeInfoPath}`,
        );
      } catch (e) {
        // ディスクの空き容量がない、他ツールからのファイルロック時をトラップ。
        // サードパーティ向けなのでVOICEVOX側には通知せず、エラー記録して継続
        log.error("Failed to write file :", e);
      }
    });
  }
}
