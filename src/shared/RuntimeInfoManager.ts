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
}

/**
 * サードパーティ向けランタイム情報のレコード定義
 * Note:変更時はOutputInfoDataFor3rdPartyのバージョン定義も変更すること
 */
export interface EngineInfoFormatFor3rdParty {
  formatVersion: number;
  appVersion: string;
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
   * Note: 破壊的変更があった場合に数字を上げること
   */
  private fileFormatVersion = 1;

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
        };
      }
    );

    const engineInfoFormatFor3rdParty: EngineInfoFormatFor3rdParty = {
      formatVersion: this.fileFormatVersion,
      appVersion: this.VOICEVOXVersion,
      engineInfos: engineInfoList,
    };

    return engineInfoFormatFor3rdParty;
  }
}
