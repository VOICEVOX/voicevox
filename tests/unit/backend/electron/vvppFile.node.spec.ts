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

  const vvppEngineDir = createVvppEngineDir();
  await extractVvpp({
    vvppLikeFilePath: outputFilePath,
    vvppEngineDir,
    tmpDir,
  });
  expectManifestExists(vvppEngineDir);
});

test("分割されたVVPPファイルからエンジンを切り出せる", async () => {
  const targetName = "perfect.vvpp";
  const sourceDir = path.join(__dirname, "vvpps", targetName);
  const outputFilePath = path.join(tmpDir, uuid4() + targetName);
  await createZipFile(sourceDir, outputFilePath);

  const outputFilePath1 = outputFilePath + ".1.vvppp";
  const outputFilePath2 = outputFilePath + ".2.vvppp";
  splitFile(outputFilePath, outputFilePath1, outputFilePath2);

  const vvppEngineDir = createVvppEngineDir();
  await extractVvpp({
    vvppLikeFilePath: outputFilePath1,
    vvppEngineDir,
    tmpDir,
  });
  expectManifestExists(vvppEngineDir);
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
        tmpDir,
      }),
    ).rejects.toThrow(expectedError);
  },
);

/** 7zを使って指定したフォルダからzipファイルを作成する */
async function createZipFile(sourceDir: string, outputFilePath: string) {
  const sevenZipBin = import.meta.env.VITE_7Z_BIN_NAME;
  const command = `"${sevenZipBin}" a -tzip "${outputFilePath}" "${path.join(sourceDir, "*")}"`;
  await promisify(exec)(command);
}

function createVvppEngineDir() {
  const dir = path.join(tmpDir, uuid4());
  fs.mkdirSync(dir);
  return dir;
}

function expectManifestExists(vvppEngineDir: string) {
  const files = fs.readdirSync(vvppEngineDir, { recursive: true });
  const manifestExists = files.some(
    (file) =>
      typeof file === "string" && path.basename(file) == "engine_manifest.json",
  );
  expect(manifestExists).toBe(true);
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
