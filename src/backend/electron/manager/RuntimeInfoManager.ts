/**
 * サードパーティ向けのランタイム情報を書き出す。
 * ランタイム情報には起動しているエンジンのURLなどが含まれる。
 */

import AsyncLock from "async-lock";
import type { AltPortInfos } from "@/store/type";
import { EngineId, EngineInfo } from "@/type/preload";
import { writeFileSafely } from "@/backend/electron/fileHelper";
import { createEngineUrl } from "@/domain/url";
import { createLogger } from "@/helpers/log";

const log = createLogger("RuntimeInfoManager");

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
          return {
            uuid: engineInfo.uuid,
            url: createEngineUrl({
              protocol: engineInfo.protocol,
              hostname: engineInfo.hostname,
              port,
              pathname: engineInfo.pathname,
            }),
            name: engineInfo.name,
          };
        }),
      };

      // ファイル書き出し
      try {
        writeFileSafely(
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

let manager: RuntimeInfoManager | undefined;

export function initializeRuntimeInfoManager(payload: {
  runtimeInfoPath: string;
  appVersion: string;
}) {
  manager = new RuntimeInfoManager(payload.runtimeInfoPath, payload.appVersion);
}

export function getRuntimeInfoManager() {
  if (manager == undefined) {
    throw new Error("RuntimeInfoManager is not initialized");
  }
  return manager;
}
