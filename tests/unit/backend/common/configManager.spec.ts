import pastConfigs from "./pastConfigs";
import config0_19_1 from "./pastConfigs/0.19.1-bug_default_preset.json";
import { BaseConfigManager } from "@/backend/common/ConfigManager";
import { Preset, PresetKey, VoiceId, configSchema } from "@/type/preload";

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

it("0.19.1からのマイグレーション時にハミング・ソングスタイル由来のデフォルトプリセットを削除できている", async () => {
  const data = config0_19_1;
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
  const presets = configManager.get("presets");
  const defaultPresetKeys = configManager.get("defaultPresetKeys");

  expect(Object.keys(defaultPresetKeys).length).toEqual(presets.keys.length);
  expect(Object.keys(presets.items).length).toEqual(presets.keys.length);

  for (const key of Object.keys(defaultPresetKeys)) {
    // VoiceIdの3番目はスタイルIDなので、それが3000以上3085以下または6000のものをソング・ハミングスタイルとみなす
    const voiceId = key as VoiceId;
    const splited = voiceId.split(":");
    const styleId = parseInt(splited[2]);
    expect(
      (styleId >= 3000 && styleId <= 3085) || styleId === 6000,
    ).toBeFalsy();

    const presetsKey: PresetKey | undefined = defaultPresetKeys[voiceId];
    expect(presetsKey).toBeTruthy();
    if (presetsKey != undefined) {
      expect(presets.keys.find((v) => v === presetsKey)).toBeTruthy();
      const preset: Preset | undefined = presets.items[presetsKey];
      expect(preset).toBeTruthy();
    }
  }
});

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
