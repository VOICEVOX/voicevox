// テスト用のファイルを読み込むのでNode環境で実行する
// @vitest-environment node

import path from "path";
import fs from "fs";
import { migrateProjectFileObject } from "@/domain/project";
import { EngineId, SpeakerId, StyleId } from "@/type/preload";

const engineId = EngineId("074fc39e-678b-4c13-8916-ffca8d505d1d");

const vvprojDir = "tests/unit/domain/vvproj/";

describe("migrateProjectFileObject", () => {
  test("v0.14.11", async () => {
    // ８期生のプロジェクトファイル
    const vvprojFile = path.resolve(vvprojDir, "0.14.11.vvproj");
    const projectData = JSON.parse(fs.readFileSync(vvprojFile, "utf-8"));

    await migrateProjectFileObject(projectData, {
      fetchMoraData: async () => {
        throw new Error("fetchMoraData is not implemented");
      },
      voices: [
        {
          engineId,
          speakerId: SpeakerId("04dbd989-32d0-40b4-9e71-17c920f2a8a9"),
          styleId: StyleId(67),
        },
        {
          engineId,
          speakerId: SpeakerId("dda44ade-5f9c-4a3a-9d2c-2a976c7476d9"),
          styleId: StyleId(68),
        },
        ...[69, 70, 71, 72, 73].map((styleId) => ({
          engineId,
          speakerId: SpeakerId("287aa49f-e56b-4530-a469-855776c84a8d"),
          styleId: StyleId(styleId),
        })),
        {
          engineId,
          speakerId: SpeakerId("97a4af4b-086e-4efd-b125-7ae2da85e697"),
          styleId: StyleId(74),
        },
      ],
    });
  });
});
