import path from "path";
import { EngineId, EngineInfo } from "@/type/preload";
/**
 * サードパーティ向けランタイム情報のエクスポート情報クラス
 */
export class RuntimeInfoManager {
  private runtimeInfoPath: string;

  constructor(userDataPath: string) {
    this.runtimeInfoPath = path.join(userDataPath, "runtime-info.json");
  }

  /**
   * サードパーティ向けランタイム情報のファイルパスを取得する
   */
  public getRuntimeInfoPath(): string {
    return this.runtimeInfoPath;
  }
}

/**
 * サードパーティ向けランタイム情報のレコード定義
 * Note:変更時はOutputInfoDataFor3rdPartyのバージョン定義も変更すること
 */
export interface EngineInfoRecordFor3rdParty {
  uuid: EngineId;
  url: string;
  name: string;
  path: string | undefined;
  executionEnabled: boolean;
  executionFilePath: string;
  executionArgs: Array<string>;
  type: string;
}

/**
 * サードパーティ向けランタイム情報のレコード定義
 * Note:変更時はOutputInfoDataFor3rdPartyのバージョン定義も変更すること
 */
export interface EngineInfoFormatFor3rdParty {
  versions: {
    fileFormat: string;
    VOICEVOX: string;
  };
  engineInfos: EngineInfoRecordFor3rdParty[];
}

/**
 * サードパーティ向けランタイム情報のエクスポートフォーマットクラス
 */
export class OutputInfoDataFor3rdParty {
  private VOICEVOXVersion: string;

  constructor(VOICEVOXVersion: string) {
    this.VOICEVOXVersion = VOICEVOXVersion;
  }

  /**
   * サードパーティ向けランタイム情報のフォーマットバージョン
   * Note: 破壊的変更（削除、型変更）があった場合にメジャーバージョンを上げる
   *       互換性のある変更（追加）があった場合にマイナーバージョンを上げる
   */
  private fileFormatVersion = "1.0";

  /**
   * サードパーティ向けに提供するデータを取得
   */
  public getOutputInfoData(
    engineInfos: EngineInfo[]
  ): EngineInfoFormatFor3rdParty {
    const engineInfoList: EngineInfoRecordFor3rdParty[] = engineInfos.map(
      (engineInfo) => {
        return {
          uuid: engineInfo.uuid,
          url: engineInfo.host,
          name: engineInfo.name,
          path: engineInfo.path,
          executionEnabled: engineInfo.executionEnabled,
          executionFilePath: engineInfo.executionFilePath,
          executionArgs: engineInfo.executionArgs,
          type: engineInfo.type,
        };
      }
    );

    const engineInfoFormatFor3rdParty: EngineInfoFormatFor3rdParty = {
      versions: {
        fileFormat: this.fileFormatVersion,
        VOICEVOX: this.VOICEVOXVersion,
      },
      engineInfos: engineInfoList,
    };

    return engineInfoFormatFor3rdParty;
  }
}
