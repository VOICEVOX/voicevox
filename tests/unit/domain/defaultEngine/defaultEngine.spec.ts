// テスト用のファイルを読み込むのでNode環境で実行する
// @vitest-environment node

import path from "path";
import fs from "fs";
import { fetchDefaultEngineUpdateInfo } from "@/domain/defaultEngine";

const currentDir = "tests/unit/domain/defaultEngine";

test("fetchDefaultEngineInfo", async () => {
  // テスト用のjsonファイルでfetchをモックする
  // 元ファイルは https://raw.githubusercontent.com/VOICEVOX/voicevox_blog/master/src/generateLatestDefaultEngineInfos.ts
  const p = path.resolve(currentDir, "latestDefaultEngineInfos.json");
  const json = fs.readFileSync(p, "utf-8");
  const spy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(json));

  // 読み込めることを確認
  const infos = await fetchDefaultEngineUpdateInfo("https://example.com/");
  expect(infos.formatVersion).toBe(1);

  spy.mockRestore();
});
