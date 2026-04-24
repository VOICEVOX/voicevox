import type {
  PackageInfo,
  RuntimeTarget,
} from "@/domain/defaultEngine/latestDefaultEngine";

/** アプリに埋め込まれたパッケージ定義情報 */
export type EnginePackageEmbeddedInfo = {
  engineName: string;
};

/** ローカルのパッケージインストール状況 */
export type EnginePackageCurrentInfo =
  | { status: "notInstalled" }
  | { status: "installed"; installedVersion: string };

/** オンラインで取得したパッケージ最新情報 */
export type EnginePackageLatestInfo = {
  availableRuntimeTargets: RuntimeTargetInfo[];
};

export type RuntimeTargetInfo = {
  target: RuntimeTarget;
  packageInfo: PackageInfo;
};
