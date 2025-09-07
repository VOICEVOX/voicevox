import fs from "node:fs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { migrateProjectFileObject } from "@/infrastructures/projectFile/migration";
import { EngineId, SpeakerId, StyleId } from "@/type/preload";
import { resetMockMode } from "@/helpers/random";
import path from "@/helpers/path";

const engineId = EngineId("074fc39e-678b-4c13-8916-ffca8d505d1d");

const vvprojDir = "tests/unit/domain/vvproj/";

beforeEach(() => {
  resetMockMode();
});

describe("migrateProjectFileObject", () => {
  test("v0.14.11", async () => {
    // ８期生のプロジェクトファイル
    const vvprojFile = path.join(vvprojDir, "0.14.11.vvproj");
    const projectData: unknown = JSON.parse(
      fs.readFileSync(vvprojFile, "utf-8"),
    );

    // マイグレーションのテスト
    const project = await migrateProjectFileObject(projectData, {
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
      showOldProjectWarningDialog: async () => true,
    });

    // スナップショットテスト
    expect(project).toMatchSnapshot();
  });
});

test("未来のバージョンのプロジェクトを読み込むと警告を出す", async () => {
  const vvprojFile = path.join(vvprojDir, "0.14.11.vvproj");
  const projectData = JSON.parse(fs.readFileSync(vvprojFile, "utf-8")) as {
    appVersion: string;
    [key: string]: unknown;
  };
  projectData.appVersion = "9999.9999.9999"; // 未来のバージョンに書き換え

  const showOldProjectWarningDialog = vi.fn(async () => false);
  const project = await migrateProjectFileObject(projectData, {
    fetchMoraData: async () => {
      throw new Error("fetchMoraData is not implemented");
    },
    voices: [],
    showOldProjectWarningDialog,
  });
  expect(showOldProjectWarningDialog).toHaveBeenCalled();
  expect(project).toEqual("oldProject");
});
