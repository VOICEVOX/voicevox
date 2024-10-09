import { tmpdir } from "os";
import { join } from "path";
import fs from "fs";
import { expect, test } from "vitest";
import { EngineId } from "@/type/preload";

import { RuntimeInfoManager } from "@/backend/electron/manager/RuntimeInfoManager";

test("想定通りのラインタイム情報が保存されている", async () => {
  const randomName = Math.random().toString(36).substring(7);
  const tempFilePath = join(tmpdir(), `runtime-info-${randomName}.json`);

  const appVersion = "999.999.999";
  const runtimeInfoManager = new RuntimeInfoManager(tempFilePath, appVersion);

  // エンジン情報
  runtimeInfoManager.setEngineInfos(
    [
      {
        uuid: EngineId("00000000-0000-0000-0000-000000000001"),
        protocol: "https:",
        hostname: "example.com",
        defaultPort: "",
        pathname: "/engine1",
        name: "engine1",
      },
      {
        uuid: EngineId("00000000-0000-0000-0000-000000000002"),
        protocol: "https:",
        hostname: "example.com",
        defaultPort: "",
        pathname: "/engine2",
        name: "engine2",
      },
      {
        uuid: EngineId("00000000-0000-0000-0000-000000000003"),
        protocol: "http:",
        hostname: "127.0.0.1",
        defaultPort: "8080",
        pathname: "",
        name: "engine3",
      },
    ],
    { [EngineId("00000000-0000-0000-0000-000000000003")]: "8081" },
  );

  // ファイル書き出し
  await runtimeInfoManager.exportFile();

  // ファイル読み込みしてスナップショットの比較
  // NOTE: スナップショットが変わった場合、破壊的変更ならformatVersionを上げる
  const savedRuntimeInfo: unknown = JSON.parse(
    fs.readFileSync(tempFilePath, "utf-8"),
  );
  expect(savedRuntimeInfo).toMatchInlineSnapshot(`
    {
      "appVersion": "999.999.999",
      "engineInfos": [
        {
          "name": "engine1",
          "url": "https://example.com/engine1",
          "uuid": "00000000-0000-0000-0000-000000000001",
        },
        {
          "name": "engine2",
          "url": "https://example.com/engine2",
          "uuid": "00000000-0000-0000-0000-000000000002",
        },
        {
          "name": "engine3",
          "url": "http://127.0.0.1:8081",
          "uuid": "00000000-0000-0000-0000-000000000003",
        },
      ],
      "formatVersion": 1,
    }
  `);
});
