import { ArtifactCreated } from "electron-builder";
import { appImageArtifactBuildCompleted } from "./appImageArtifactBuildCompleted";

export default async function artifactBuildCompleted(
  artifactCreated: ArtifactCreated,
) {
  const platformName = artifactCreated.packager.platform.name;
  const targetName = artifactCreated.target?.name;
  if (platformName === "linux" && targetName === "appImage") {
    await appImageArtifactBuildCompleted(artifactCreated);
  }
}
