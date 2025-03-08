import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, expect, test } from "vitest";
import { createVvppFile } from "./helper";
import { EngineId, MinimumEngineManifestType } from "@/type/preload";
import VvppManager from "@/backend/electron/manager/vvppManager";
import { uuid4 } from "@/helpers/random";

interface Context {
  vvppEngineDir: string;
  manager: VvppManager;
}

let tmpDir: string;
beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), uuid4()));
});
afterAll(() => {
  fs.rmdirSync(tmpDir, { recursive: true });
});

beforeEach<Context>(async (context) => {
  context.vvppEngineDir = path.join(tmpDir, uuid4());
  context.manager = new VvppManager({
    vvppEngineDir: context.vvppEngineDir,
    tmpDir,
  });
});

test<Context>("追加エンジンのディレクトリ名は想定通りか", ({ manager }) => {
  const dummyMinimumManifest: MinimumEngineManifestType = {
    name: "Test Engine",
    uuid: EngineId("295c656b-b800-449f-aee6-b03e493816d7"),
    command: "",
    port: 5021,
    supported_features: {},
  };

  const dirName = manager.toValidDirName(dummyMinimumManifest);
  // NOTE: パターンを変更する場合アンインストーラーのコードを変更する必要がある
  const pattern = /^.+\+.{8}-.{4}-.{4}-.{4}-.{12}$/;

  expect(dirName).toMatch(pattern);
});

test<Context>("エンジンをインストールできる", async ({
  vvppEngineDir,
  manager,
}) => {
  const targetName = "perfect.vvpp";
  const vvppFilePath = await createVvppFile(targetName, tmpDir);

  await manager.install(vvppFilePath);
  expect(getEngineDirInfos(vvppEngineDir).length).toBe(1);
});

test<Context>("エンジンを２回インストールすると処理が予約され、後で上書きされる", async ({
  vvppEngineDir,
  manager,
}) => {
  const targetName = "perfect.vvpp";
  const vvppFilePath = await createVvppFile(targetName, tmpDir);

  await manager.install(vvppFilePath);
  const infos1 = getEngineDirInfos(vvppEngineDir);
  expect(infos1.length).toBe(1);

  await manager.install(vvppFilePath);
  const infos2 = getEngineDirInfos(vvppEngineDir);
  expect(infos2.length).toBe(1);
  expect(infos1[0].createdTime).toBe(infos2[0].createdTime); // 同じファイル

  await manager.handleMarkedEngineDirs();
  const infos3 = getEngineDirInfos(vvppEngineDir);
  expect(infos3.length).toBe(1);
  expect(infos1[0].createdTime).not.toBe(infos3[0].createdTime); // 別のファイル
});

test<Context>("エンジンをアンインストール予約すると、後で削除される", async ({
  vvppEngineDir,
  manager,
}) => {
  const targetName = "perfect.vvpp";
  const targetUuid = EngineId("00000000-0000-0000-0000-000000000001");
  const vvppFilePath = await createVvppFile(targetName, tmpDir);

  await manager.install(vvppFilePath);
  const infos1 = getEngineDirInfos(vvppEngineDir);
  expect(infos1.length).toBe(1);

  manager.markWillDelete(targetUuid);
  const infos2 = getEngineDirInfos(vvppEngineDir);
  expect(infos2.length).toBe(1);

  await manager.handleMarkedEngineDirs();
  const infos3 = getEngineDirInfos(vvppEngineDir);
  expect(infos3.length).toBe(0);
});

/**
 * インストールされているエンジンディレクトリの情報を取得する
 */
export function getEngineDirInfos(vvppEngineDir: string) {
  const files = fs.readdirSync(vvppEngineDir, {
    recursive: true,
    withFileTypes: true,
  });
  const notTmpFiles = files.filter((file) => !file.parentPath.includes(".tmp"));
  const manifestFiles = notTmpFiles.filter(
    (file) => path.basename(file.name) === "engine_manifest.json",
  );
  const infos = manifestFiles.map((file) => ({
    createdTime: fs.statSync(path.join(file.parentPath, file.name)).ctimeMs,
  }));
  return infos;
}
