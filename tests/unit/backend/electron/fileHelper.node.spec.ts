import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { beforeAll, afterAll, describe, expect, test } from "vitest";
import {
  isPathWithinDirectory,
  writeFileSafely,
} from "@/backend/electron/fileHelper";
import { uuid4 } from "@/helpers/random";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), uuid4()));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

describe("isPathWithinDirectory", () => {
  const rootDir = process.platform === "win32" ? "C:" : "/";
  test("ファイルパスが指定したディレクトリ内にある", () => {
    const inputDir = path.join(rootDir, "A", "B", "C");
    const withinPath1 = path.join(inputDir, "D");
    expect(isPathWithinDirectory(inputDir, withinPath1)).toBe(true);

    const startsWithDotDotPath = path.join(inputDir, "..D");
    expect(isPathWithinDirectory(inputDir, startsWithDotDotPath)).toBe(true);

    const withinPath2 = path.join(withinPath1, "E");
    expect(isPathWithinDirectory(inputDir, withinPath2)).toBe(true);
  });

  test("ファイルパスが指定したディレクトリ内にない", () => {
    const inputDir = path.join(rootDir, "A", "B", "C");
    const parentDirectoryPath = path.dirname(inputDir);
    expect(isPathWithinDirectory(inputDir, parentDirectoryPath)).toBe(false);

    const outsidePath = path.join(parentDirectoryPath, "1", "2");
    expect(isPathWithinDirectory(inputDir, outsidePath)).toBe(false);
  });

  test("ファイルパスが同じ", () => {
    const inputDir = path.join(rootDir, "A", "B", "C");
    expect(isPathWithinDirectory(inputDir, inputDir)).toBe(false);
  });

  test("ファイルパスが正規化されていない", () => {
    const inputDir = path.join(rootDir, "A", "B", "C");
    const withinPath1 = path.join(inputDir, "..", "..", "B", "C", "D");
    expect(isPathWithinDirectory(inputDir, withinPath1)).toBe(true);

    const withinPath2 = inputDir + "//D//E";
    expect(isPathWithinDirectory(inputDir, withinPath2)).toBe(true);

    const outsidePath1 = path.join(rootDir, "..", "..", "1");
    expect(isPathWithinDirectory(inputDir, outsidePath1)).toBe(false);

    const outsidePath2 = inputDir + "/..//1//2";
    expect(isPathWithinDirectory(inputDir, outsidePath2)).toBe(false);

    const sameDir = inputDir + "/..//C";
    expect(isPathWithinDirectory(inputDir, sameDir)).toBe(false);
  });

  test.skipIf(process.platform !== "win32")("ドライブレターが異なる", () => {
    const inputDir = "C:\\A";
    const inputPath = "D:\\A\\B";
    expect(isPathWithinDirectory(inputDir, inputPath)).toBe(false);
  });

  test.skipIf(process.platform !== "win32")(
    "ファイルパスが正規化されていない(Windows)",
    () => {
      const inputDir = path.join(rootDir, "A", "B", "C");
      const lowercasePath = path.join(inputDir, "D", "E").toLowerCase();
      expect(isPathWithinDirectory(inputDir, lowercasePath)).toBe(true);

      const notNormalizedPath1 = path.join(inputDir, "..", "..", "B", "c", "d");
      expect(isPathWithinDirectory(inputDir, notNormalizedPath1)).toBe(true);

      const notNormalizedPath2 = inputDir + "/..\\\\c/d";
      expect(isPathWithinDirectory(inputDir, notNormalizedPath2)).toBe(true);
    },
  );
});

describe("writeFileSafely", () => {
  test("ファイルを書き込める", async () => {
    const filePath = path.join(tmpDir, uuid4());
    const content = "Hello World";
    writeFileSafely(filePath, content);
    expect(fs.readFileSync(filePath, "utf-8")).toBe(content);
  });

  test("ファイルを上書きできる", async () => {
    const filePath = path.join(tmpDir, uuid4());
    fs.writeFileSync(filePath, "old content");
    const newContent = "new content";
    writeFileSafely(filePath, newContent);
    expect(fs.readFileSync(filePath, "utf-8")).toBe(newContent);
  });

  test("存在しないディレクトリに書き込もうとするとエラー", async () => {
    const nonExistentDir = path.join(tmpDir, uuid4(), "not-exist");
    const filePath = path.join(nonExistentDir, "test.txt");
    expect(() => writeFileSafely(filePath, "data")).toThrow();
  });

  test("指定したパスにディレクトリが存在するとエラー", async () => {
    const filePath = path.join(tmpDir, uuid4());
    fs.mkdirSync(filePath);
    expect(() => writeFileSafely(filePath, "data")).toThrow();
  });
});
