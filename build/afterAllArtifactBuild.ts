import type { BuildResult } from "electron-builder";
import splitNsisArchive from "./splitNsisArchive";

export default async function afterAllArtifactBuild(buildResult: BuildResult) {
  for (const [platform, targets] of buildResult.platformToTargets.entries()) {
    const platformName = platform.name;

    if (platformName === "windows") {
      for (const [targetKey, target] of targets.entries()) {
        if (targetKey === "nsis-web") {
          await splitNsisArchive(target);
        }
        // else: nop
      }
    }
    // else: nop
  }
  return [];
}
