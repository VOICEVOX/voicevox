/* eslint-disable @typescript-eslint/no-require-imports */
const afterWindowsNsisWebArtifactBuild =
  require("./afterNsisWebArtifactBuild.cjs").default;

// buildResult: electron-builder.BuildResult
module.exports.default = async function (buildResult) {
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
