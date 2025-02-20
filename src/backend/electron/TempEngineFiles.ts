import fs from "fs";
import { moveFile } from "move-file";
import { MinimumEngineManifestType } from "@/type/preload";

/**
 * VVPPインストール直前の一時エンジンファイル群。
 * 実態はディレクトリ。
 */
export class TempEngineFiles {
  private manifest: MinimumEngineManifestType;
  private tmpEngineDir: string;

  constructor(params: {
    manifest: MinimumEngineManifestType;
    engineDir: string;
  }) {
    this.manifest = params.manifest;
    this.tmpEngineDir = params.engineDir;
  }

  getManifest() {
    return this.manifest;
  }

  getTmpEngineDir() {
    return this.tmpEngineDir;
  }

  async move(destDir: string) {
    await moveFile(this.tmpEngineDir, destDir);
  }

  async cleanup() {
    await fs.promises.rmdir(this.tmpEngineDir, { recursive: true });
  }
}
