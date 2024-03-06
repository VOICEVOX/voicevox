// テスト用のファイルを読み込むのでNode環境で実行する
// @vitest-environment node

import path from "path";
import fs from "fs";
import { migrateProjectFileObject } from "@/domain/project";
import { EngineId, StyleId } from "@/type/preload";

const engineId = EngineId("074fc39e-678b-4c13-8916-ffca8d505d1d");

const vvprojDir = path.resolve(__dirname, "vvproj");

describe("migrateProjectFileObject", () => {
  test("v0.14.11", async () => {
    // ８期生のプロジェクトファイル
    const vvprojFile = path.resolve(vvprojDir, "v0.14.11.vvproj");
    const projectData = JSON.parse(fs.readFileSync(vvprojFile, "utf-8"));

    await migrateProjectFileObject(projectData, {
      fetchMoraData: async () => {
        throw new Error("fetchMoraData is not implemented");
      },
      characterInfos: [
        {
          metas: {
            styles: [{ styleId: StyleId(67), engineId }],
            speakerUuid: "04dbd989-32d0-40b4-9e71-17c920f2a8a9",
          },
        },
        {
          metas: {
            styles: [{ styleId: StyleId(68), engineId }],
            speakerUuid: "dda44ade-5f9c-4a3a-9d2c-2a976c7476d9",
          },
        },
        {
          metas: {
            styles: [
              { styleId: StyleId(69), engineId },
              { styleId: StyleId(70), engineId },
              { styleId: StyleId(71), engineId },
              { styleId: StyleId(72), engineId },
              { styleId: StyleId(73), engineId },
            ],
            speakerUuid: "287aa49f-e56b-4530-a469-855776c84a8d",
          },
        },
        {
          metas: {
            styles: [{ styleId: StyleId(74), engineId }],
            speakerUuid: "97a4af4b-086e-4efd-b125-7ae2da85e697",
          },
        },
      ],
    });
  });
});
