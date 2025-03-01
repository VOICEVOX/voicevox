import os from "os";
import path from "path";
import fs from "fs";
import { test, afterAll, beforeAll } from "vitest";
import { createVvppFile } from "./helper";
import { VvppFileExtractor } from "@/backend/electron/vvppFile";
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
  const vvppFilePath = await createVvppFile(targetName, tmpDir);

  const outputDir = buildOutputDir();
  await new VvppFileExtractor({
    vvppLikeFilePath: vvppFilePath,
    outputDir,
    tmpDir,
  }).extract();
  assertIsEngineDir(outputDir);
});

test("分割されたVVPPファイルからエンジンを切り出せる", async () => {
  const targetName = "perfect.vvpp";
  const vvppFilePath = await createVvppFile(targetName, tmpDir);

  const vvpppFilePath1 = vvppFilePath + ".1.vvppp";
  const vvpppFilePath2 = vvppFilePath + ".2.vvppp";
  splitFile(vvppFilePath, vvpppFilePath1, vvpppFilePath2);

  const outputDir = buildOutputDir();
  await new VvppFileExtractor({
    vvppLikeFilePath: vvpppFilePath1,
    outputDir,
    tmpDir,
  }).extract();
  assertIsEngineDir(outputDir);
});

test.each([
  ["invalid_manifest.vvpp", /SyntaxError|is not valid JSON/],
  ["no_engine_id.vvpp", undefined], // TODO: エンジンIDが見つからない専用のエラーを用意する
  ["no_manifest.vvpp", /ENOENT|engine_manifest.json/],
])(
  "不正なVVPPファイルからエンジンを切り出せない: %s",
  async (targetName, expectedError) => {
    const outputFilePath = await createVvppFile(targetName, tmpDir);
    await expect(
      new VvppFileExtractor({
        vvppLikeFilePath: outputFilePath,
        outputDir: buildOutputDir(),
        tmpDir,
      }).extract(),
    ).rejects.toThrow(expectedError);
  },
);

function buildOutputDir() {
  const dir = path.join(tmpDir, uuid4());
  fs.mkdirSync(dir);
  return dir;
}

/**
 * エンジンディレクトリであることを確認する。
 */
function assertIsEngineDir(vvppEngineDir: string) {
  const files = fs.readdirSync(vvppEngineDir, { recursive: true });
  const manifestExists = files.some(
    (file) =>
      typeof file === "string" &&
      path.basename(file) === "engine_manifest.json",
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
