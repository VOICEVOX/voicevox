import os from "os";
import path from "path";
import { exec } from "child_process";
import fs from "fs";
import { promisify } from "util";
import { test, afterAll, beforeAll } from "vitest";
import { extractVvpp } from "@/backend/electron/vvppFile";
import { uuid4 } from "@/helpers/random";

let tmpDir: string;
beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), uuid4()));
});
afterAll(() => {
  fs.rmdirSync(tmpDir, { recursive: true });
});

test("正しいVVPPファイルからエンジンを切り出せる", async () => {
  const targetName = "perfect.vvpp";
  const sourceDir = path.join(__dirname, "vvpps", targetName);
  const outputFilePath = path.join(tmpDir, uuid4() + targetName);
  await createZipFile(sourceDir, outputFilePath);
  await extractVvpp({
    vvppLikeFilePath: outputFilePath,
    vvppEngineDir: tmpDir,
  });
});

test("分割されたVVPPファイルからエンジンを切り出せる", async () => {
  const targetName = "perfect.vvpp";
  const sourceDir = path.join(__dirname, "vvpps", targetName);
  const outputFilePath = path.join(tmpDir, uuid4() + targetName);
  await createZipFile(sourceDir, outputFilePath);

  const outputFilePath1 = outputFilePath + ".1.vvppp";
  const outputFilePath2 = outputFilePath + ".2.vvppp";
  splitFile(outputFilePath, outputFilePath1, outputFilePath2);
  await extractVvpp({
    vvppLikeFilePath: outputFilePath1,
    vvppEngineDir: tmpDir,
  });
});

test.each([
  ["invalid_manifest.vvpp", /SyntaxError|is not valid JSON/],
  ["no_engine_id.vvpp", undefined], // TODO: エンジンIDが見つからない専用のエラーを用意する
  ["no_manifest.vvpp", /ENOENT|engine_manifest.json/],
])(
  "不正なVVPPファイルからエンジンを切り出せない: %s",
  async (targetName, expectedError) => {
    const sourceDir = path.join(__dirname, "vvpps", targetName);
    const outputFilePath = path.join(tmpDir, uuid4() + targetName);
    await createZipFile(sourceDir, outputFilePath);
    await expect(
      extractVvpp({
        vvppLikeFilePath: outputFilePath,
        vvppEngineDir: tmpDir,
      }),
    ).rejects.toThrow(expectedError);
  },
);

/** 7zを使って指定したフォルダからzipファイルを作成する */
async function createZipFile(sourceDir: string, outputFilePath: string) {
  const zipBin = import.meta.env.VITE_7Z_BIN_NAME;
  const command = `"${zipBin}" a -tzip "${outputFilePath}" "${path.join(sourceDir, "*")}"`;
  await promisify(exec)(command);
}

/** ファイルを2つに分割する */
function splitFile(
  inputFilePath: string,
  outputFilePath1: string,
  outputFilePath2: string,
) {
  const data = fs.readFileSync(inputFilePath);
  const midPoint = Math.floor(data.length / 2);
  fs.writeFileSync(outputFilePath1, data.subarray(0, midPoint));
  fs.writeFileSync(outputFilePath2, data.subarray(midPoint));
}
