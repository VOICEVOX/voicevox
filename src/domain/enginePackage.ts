import type {
  PackageInfo,
  RuntimeTarget,
} from "@/domain/defaultEngine/latestDefaultEngine";

/** ビルド時に定義されたパッケージ情報
 *
 * TODO: BuildInfoという名前よりもっといい名前があるはずなので変える
 */
export type EnginePackageBuildInfo = {
  engineName: string;
};

/** ローカルのパッケージインストール状況 */
export type EnginePackageCurrentInfo =
  | { status: "notInstalled" }
  | { status: "installed"; installedVersion: string };

/** オンラインで取得したパッケージ最新情報 */
export type EnginePackageLatestInfo = {
  availableRuntimeTargets: {
    target: RuntimeTarget;
    packageInfo: PackageInfo;
  }[];
};
