import { Target } from "electron-builder";
import splitNsisArchive from "./splitNsisArchive";

export async function afterNsisWebArtifactBuild(target: Target) {
  await splitNsisArchive(target);
}
