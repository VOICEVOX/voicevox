import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { beforeEach, expect, test } from "vitest";
import { EngineId, MinimumEngineManifestType } from "@/type/preload";
import VvppManager from "@/backend/electron/manager/vvppManager";

const dummyMinimumManifest: MinimumEngineManifestType = {
  name: "Test Engine",
  uuid: EngineId("295c656b-b800-449f-aee6-b03e493816d7"),
  command: "",
  port: 5021,
  supported_features: {},
};

interface VvppManagerTestContext {
  manager: VvppManager;
}

beforeEach<VvppManagerTestContext>(async (context) => {
  const vvppEngineDir = await mkdtemp(join(tmpdir(), "vvppTest"));
  context.manager = new VvppManager({ vvppEngineDir });

  return async () => {
    await rm(vvppEngineDir, { recursive: true });
  };
});

test<VvppManagerTestContext>("追加エンジンのディレクトリ名は想定通りか", ({
  manager,
}) => {
  const dirName = manager.toValidDirName(dummyMinimumManifest);
  // NOTE: パターンを変更する場合アンインストーラーのコードを変更する必要がある
  const pattern = /^.+\+.{8}-.{4}-.{4}-.{4}-.{12}$/;

  expect(dirName).toMatch(pattern);
});
