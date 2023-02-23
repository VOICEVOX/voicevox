/* eslint-disable @typescript-eslint/no-var-requires */
const afterWindowsNsisWebArtifactBuild =
  require("./afterNsisWebArtifactBuild").default;

// buildResult: electron-builder.BuildResult
exports.default = async function (buildResult) {
  for (const [platform, targets] of buildResult.platformToTargets.entries()) {
    const platformName = platform.name;

    if (platformName === "windows") {
      for (const [targetKey, target] of targets.entries()) {
        if (targetKey === "nsis-web") {
          await afterWindowsNsisWebArtifactBuild(target);
        }
        // else: nop
      }
    }
    // else: nop
  }
};
