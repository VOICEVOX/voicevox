// テスト用のファイルを読み込むのでNode環境で実行する
// @vitest-environment node

import path from "path";
import fs from "fs";
import { migrateProjectFileObject } from "@/domain/project";

// vvprojディレクトリにある*.vvprojファイルを取得
const vvprojDir = path.resolve(__dirname, "vvproj");
const vvprojPaths = fs
  .readdirSync(vvprojDir)
  .filter((name) => name.endsWith(".vvproj"))
  .map((name) => path.join(vvprojDir, name));

test.each(vvprojPaths)("migrateProjectFileObject %s", async (vvprojFile) => {
  const projectData = JSON.parse(fs.readFileSync(vvprojFile, "utf-8"));
  await migrateProjectFileObject(projectData, {
    fetchMoraData: async () => {
      throw new Error("fetchMoraData is not implemented");
    },
    characterInfos: [],
  });
});
