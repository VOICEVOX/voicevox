import path from "node:path";
import { chmodSync, cpSync, renameSync } from "node:fs";
import type { AfterPackContext } from "electron-builder";

export type VoicevoxEnginePlacement =
  | { mode: "none" }
  | { mode: "copy" | "move"; directory: string };

/** Electronアプリのパッケージング後処理を行う */
export default function afterPack(
  context: AfterPackContext,
  voicevoxEnginePlacement: VoicevoxEnginePlacement,
) {
  // NOTE: エンジンをここで配置する理由は、Windowsの再署名を避けつつ、macOSのapp署名前に組み込むため
  placeVoicevoxEngine(context, voicevoxEnginePlacement);
}

/** VOICEVOX ENGINEを配置する */
function placeVoicevoxEngine(
  context: AfterPackContext,
  voicevoxEnginePlacement: VoicevoxEnginePlacement,
) {
  if (voicevoxEnginePlacement.mode === "none") {
    return;
  }

  const destinationRoot =
    context.electronPlatformName === "darwin"
      ? getMacosResourcesPath(context)
      : context.appOutDir;
  const destination = path.join(destinationRoot, "vv-engine");
  const source = voicevoxEnginePlacement.directory;
  if (voicevoxEnginePlacement.mode === "move") {
    renameSync(source, destination);
  } else {
    cpSync(source, destination, { recursive: true, verbatimSymlinks: true });
  }

  if (context.electronPlatformName !== "win32") {
    const executablePath = path.join(destination, "run");
    chmodSync(executablePath, 0o755);
  }
}

/** macOSアプリのResourcesのパスを得る */
function getMacosResourcesPath(context: AfterPackContext): string {
  return path.join(getMacosContentsPath(context), "Resources");
}

/** macOSアプリのContentsのパスを得る */
function getMacosContentsPath(context: AfterPackContext): string {
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  return path.join(appPath, "Contents");
}
