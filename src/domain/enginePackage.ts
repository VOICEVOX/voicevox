import type {
  PackageInfo,
  RuntimeTarget,
} from "@/domain/defaultEngine/latestDefaultEngine";
import type { EngineId } from "@/type/preload";

export type EnginePackageBase = {
  engineName: string;
  engineId: EngineId;
};

/** ローカルのパッケージインストール状況 */
export type EnginePackageCurrentInfo = {
  package: EnginePackageBase;
  installed:
    | { status: "notInstalled" }
    | { status: "installed"; installedVersion: string };
};

/** オンラインで取得したパッケージ最新情報 */
export type EnginePackageLatestInfo = {
  package: EnginePackageBase;
  availableRuntimeTargets: {
    target: RuntimeTarget;
    packageInfo: PackageInfo;
  }[];
};
