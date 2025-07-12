import { BuildResult } from "electron-builder";
import { afterNsisWebArtifactBuild } from "./afterNsisWebArtifactBuild";

export default async function afterAllArtifactBuild(buildResult: BuildResult) {
  for (const [platform, targets] of buildResult.platformToTargets.entries()) {
    const platformName = platform.name;

    if (platformName === "windows") {
      for (const [targetKey, target] of targets.entries()) {
        if (targetKey === "nsis-web") {
          await afterNsisWebArtifactBuild(target);
        }
        // else: nop
      }
    }
    // else: nop
  }
  return [];
}
