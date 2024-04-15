import pastConfigs from "./pastConfigs";
import { BaseConfigManager } from "@/backend/common/ConfigManager";
import { configSchema } from "@/type/preload";

const configBase = {
  ...configSchema.parse({}),
  __internal__: {
    migrations: {
      version: "999.999.999",
    },
  },
};

class TestConfigManager extends BaseConfigManager {
  getAppVersion() {
    return "999.999.999";
  }

  async exists() {
    throw new Error("mockで実装してください");

    // Unreachableだが、一応booleanを返さないとモックできないので返しておく。
    return false;
  }

  async load() {
    throw new Error("mockで実装してください");

    return {} as ReturnType<BaseConfigManager["load"]>;
  }

  // VitestのmockFn.mock.callsの型のために引数を受け取るようにしている。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async save(config: Parameters<BaseConfigManager["save"]>[0]) {
    throw new Error("mockで実装してください");
  }
}

it("新規作成できる", async () => {
  vi.spyOn(TestConfigManager.prototype, "exists").mockImplementation(
    async () => false,
  );
  vi.spyOn(TestConfigManager.prototype, "save").mockImplementation(
    async () => undefined,
  );

  const configManager = new TestConfigManager();
  await configManager.initialize();
  expect(configManager).toBeTruthy();
});

it("バージョンが保存される", async () => {
  vi.spyOn(TestConfigManager.prototype, "exists").mockImplementation(
    async () => false,
  );
  const saveSpy = vi
    .spyOn(TestConfigManager.prototype, "save")
    .mockImplementation(async () => undefined);

  const configManager = new TestConfigManager();
  await configManager.initialize();
  await configManager.ensureSaved();
  expect(saveSpy).toHaveBeenCalled();
  const savedData = saveSpy.mock.calls[0][0];
  expect(savedData.__internal__.migrations.version).toBe("999.999.999");
});

for (const [version, data] of pastConfigs) {
  it(`${version}からマイグレーションできる`, async () => {
    vi.spyOn(TestConfigManager.prototype, "exists").mockImplementation(
      async () => true,
    );
    vi.spyOn(TestConfigManager.prototype, "save").mockImplementation(
      async () => undefined,
    );
    vi.spyOn(TestConfigManager.prototype, "load").mockImplementation(
      async () => data,
    );

    const configManager = new TestConfigManager();
    await configManager.initialize();
    expect(configManager).toBeTruthy();
  });
}

it("getできる", async () => {
  vi.spyOn(TestConfigManager.prototype, "exists").mockImplementation(
    async () => true,
  );
  vi.spyOn(TestConfigManager.prototype, "save").mockImplementation(
    async () => undefined,
  );
  vi.spyOn(TestConfigManager.prototype, "load").mockImplementation(
    async () => ({
      ...configBase,
      inheritAudioInfo: false,
    }),
  );

  const configManager = new TestConfigManager();
  await configManager.initialize();
  expect(configManager.get("inheritAudioInfo")).toBe(false);
});

it("setできる", async () => {
  vi.spyOn(TestConfigManager.prototype, "exists").mockImplementation(
    async () => true,
  );
  vi.spyOn(TestConfigManager.prototype, "save").mockImplementation(
    async () => undefined,
  );
  vi.spyOn(TestConfigManager.prototype, "load").mockImplementation(
    async () => ({
      ...configBase,
      inheritAudioInfo: false,
    }),
  );

  const configManager = new TestConfigManager();
  await configManager.initialize();
  configManager.set("inheritAudioInfo", true);
  expect(configManager.get("inheritAudioInfo")).toBe(true);
});
