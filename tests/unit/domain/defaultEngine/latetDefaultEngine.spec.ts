import { vi, expect, test, describe, afterEach } from "vitest";
import latestDefaultEngineInfos from "./latestDefaultEngineInfos.json";
import {
  fetchLatestDefaultEngineInfo,
  getSuitablePackageInfo,
} from "@/domain/defaultEngine/latetDefaultEngine";

test("fetchLatestDefaultEngineInfo", async () => {
  // テスト用のjsonファイルでfetchをモックする
  // 元ファイルは https://raw.githubusercontent.com/VOICEVOX/voicevox_blog/master/src/generateLatestDefaultEngineInfos.ts
  const spy = vi
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(latestDefaultEngineInfos)));

  // 読み込めることを確認
  const infos = await fetchLatestDefaultEngineInfo("https://example.com/");
  expect(infos.formatVersion).toBe(1);

  spy.mockRestore();
});

describe("getSuitablePackageInfo", () => {
  const originalPlatform = process.platform;
  const originalArch = process.arch;

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    Object.defineProperty(process, "arch", { value: originalArch });
  });

  test("Windows x64ではGPU/CPU版を返す", () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    Object.defineProperty(process, "arch", { value: "x64" });

    const result = getSuitablePackageInfo(latestDefaultEngineInfos);
    expect(result).toBe(latestDefaultEngineInfos.windows.x64["GPU/CPU"]);
  });

  test("macOS x64ではCPU版を返す", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    Object.defineProperty(process, "arch", { value: "x64" });

    const result = getSuitablePackageInfo(latestDefaultEngineInfos);
    expect(result).toBe(latestDefaultEngineInfos.macos.x64.CPU);
  });

  test("macOS arm64ではCPU版を返す", () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    Object.defineProperty(process, "arch", { value: "arm64" });

    const result = getSuitablePackageInfo(latestDefaultEngineInfos);
    expect(result).toBe(latestDefaultEngineInfos.macos.arm64.CPU);
  });

  test("Linux x64ではCPU版を返す", () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    Object.defineProperty(process, "arch", { value: "x64" });

    const result = getSuitablePackageInfo(latestDefaultEngineInfos);
    expect(result).toBe(latestDefaultEngineInfos.linux.x64.CPU);
  });

  test("サポートされていないプラットフォームではエラーを投げる", () => {
    Object.defineProperty(process, "platform", { value: "freebsd" });
    Object.defineProperty(process, "arch", { value: "x64" });

    expect(() => getSuitablePackageInfo(latestDefaultEngineInfos)).toThrow(
      "Unsupported platform: freebsd x64",
    );
  });
});
