import { exec } from "child_process";
import { promisify } from "util";
import path from "@/helpers/path";
import { uuid4 } from "@/helpers/random";

/** テスト用のVVPPファイルを作成する */
export async function createVvppFile(targetName: string, tmpDir: string) {
  const sourceDir = path.join(__dirname, "vvpps", targetName);
  const outputFilePath = path.join(tmpDir, uuid4() + targetName);
  await createZipFile(sourceDir, outputFilePath);
  return outputFilePath;
}

/** 7zを使って指定したフォルダからzipファイルを作成する */
async function createZipFile(sourceDir: string, outputFilePath: string) {
  const sevenZipBin = import.meta.env.VITE_7Z_BIN_NAME;
  const command = `"${sevenZipBin}" a -tzip "${outputFilePath}" "${path.join(sourceDir, "*")}"`;
  await promisify(exec)(command);
}
