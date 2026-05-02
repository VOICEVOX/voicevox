import fs from "node:fs";
import { moveFile } from "move-file";
import type { MinimumEngineManifestType } from "@/type/preload";

/**
 * VVPPインストール直前に展開されたエンジンファイル群。
 * 実態はディレクトリ。
 */
export class ExtractedEngineFiles {
  private manifest: MinimumEngineManifestType;
  private extractedEngineDir: string;

  constructor(params: {
    manifest: MinimumEngineManifestType;
    engineDir: string;
  }) {
    this.manifest = params.manifest;
    this.extractedEngineDir = params.engineDir;
  }

  getManifest() {
    return this.manifest;
  }

  getExtractedEngineDir() {
    return this.extractedEngineDir;
  }

  async move(destDir: string) {
    await moveFile(this.extractedEngineDir, destDir);
  }

  async cleanup() {
    await fs.promises.rmdir(this.extractedEngineDir, { recursive: true });
  }

  /**
   * 後処理が必要かどうか。moveかcleanupを実行済みであれば不要。
   * 主にテスト用。
   */
  async needsCleanup() {
    return fs.existsSync(this.extractedEngineDir);
  }
}
