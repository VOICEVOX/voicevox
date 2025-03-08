import fs from "fs";
import path from "path";
import os from "os";
import { test, expect, beforeAll, afterAll } from "vitest";
import { writeFileSafely } from "@/backend/electron/fileHelper";
import { uuid4 } from "@/helpers/random";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), uuid4()));
});

afterAll(() => {
  fs.rmdirSync(tmpDir, { recursive: true });
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
