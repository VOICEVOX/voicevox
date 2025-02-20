import fs from "fs";
import { moveFile } from "move-file";
import { MinimumEngineManifestType } from "@/type/preload";

/**
 * VVPPインストール直前の一時エンジンファイル群。
 * 実態はディレクトリ。
 */
export class TempEngineFiles {
  private manifest: MinimumEngineManifestType;
  private engineDir: string;

  constructor(params: {
    manifest: MinimumEngineManifestType;
    engineDir: string;
  }) {
    this.manifest = params.manifest;
    this.engineDir = params.engineDir;
  }

  getManifest() {
    return this.manifest;
  }

  async move(destDir: string) {
    await moveFile(this.engineDir, destDir);
  }

  async cleanup() {
    await fs.promises.rmdir(this.engineDir, { recursive: true });
  }
}
