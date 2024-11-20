import latestDefaultEngineInfos from "./latestDefaultEngineInfos.json";
import { fetchLatestDefaultEngineInfo } from "@/domain/defaultEngine/latetDefaultEngine";

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
