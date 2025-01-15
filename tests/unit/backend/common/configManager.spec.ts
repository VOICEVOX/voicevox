import pastConfigs from "./pastConfigs";
import configBugDefaultPreset1996 from "./pastConfigs/0.19.1-bug_default_preset.json";
import { BaseConfigManager } from "@/backend/common/ConfigManager";
import { getConfigSchema } from "@/type/preload";

const configBase = {
  ...getConfigSchema({ isMac: false }).parse({}),
  __internal__: {
    migrations: {
      version: "999.999.999",
    },
  },
};

class TestConfigManager extends BaseConfigManager {
  constructor() {
    super({ isMac: false });
  }

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

afterEach(() => {
  vi.resetAllMocks();
});

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

    // マイグレーション後のデータが正しいことをスナップショットで確認
    expect(configManager.getAll()).toMatchSnapshot();
  });
}

it("0.19.1からのマイグレーション時にハミング・ソングスタイル由来のデフォルトプリセットを削除できている", async () => {
  const data = configBugDefaultPreset1996;
  vi.spyOn(TestConfigManager.prototype, "exists").mockImplementation(
    async () => true,
  );
  vi.spyOn(TestConfigManager.prototype, "save").mockImplementation(
    async () => undefined,
  );
  vi.spyOn(TestConfigManager.prototype, "load").mockImplementation(
    async () => data,
  );

  // VoiceIdからスタイルIDを取得する。VoiceIdの3番目がスタイルID。
  function getStyleIdFromVoiceId(voiceId: string): number {
    const splited = voiceId.split(":");
    const styleId = parseInt(splited[2]);
    return styleId;
  }

  // ソング・ハミングスタイルかどうかを判定する
  function isSingerLikeStyle(styleId: number): boolean {
    // スタイルIDが3000以上3085以下または6000のものをソング・ハミングスタイルとみなす
    return (styleId >= 3000 && styleId <= 3085) || styleId === 6000;
  }

  // マイグレーション前のデフォルトプリセットのスタイルID
  const beforeDefaultPresetStyleIds = Object.keys(
    configBugDefaultPreset1996.defaultPresetKeys,
  ).map((key) => getStyleIdFromVoiceId(key));

  // マイグレーション
  const configManager = new TestConfigManager();
  await configManager.initialize();
  const presets = configManager.get("presets");
  const defaultPresetKeys = configManager.get("defaultPresetKeys");

  // ソング・ハミングスタイルのデフォルトプリセットが削除されていることを確認
  const afterDefaultPresetStyleIds = Object.keys(defaultPresetKeys).map((key) =>
    getStyleIdFromVoiceId(key),
  );
  const deletedStyleIds = beforeDefaultPresetStyleIds.filter(
    (styleId) => !afterDefaultPresetStyleIds.includes(styleId),
  );
  expect(deletedStyleIds.length).toBe(86 - 5 + 1);
  expect(deletedStyleIds.every(isSingerLikeStyle)).toBeTruthy();

  // 残っているデフォルトプリセットはトークスタイルなことを確認
  const remainingStyleIds = afterDefaultPresetStyleIds.filter(
    (styleId) => !deletedStyleIds.includes(styleId),
  );
  expect(
    remainingStyleIds.every((styleId) => !isSingerLikeStyle(styleId)),
  ).toBeTruthy();

  // プリセットが削除されていることを確認
  expect(remainingStyleIds.length).toBe(presets.keys.length);
  expect(remainingStyleIds.length).toBe(Object.keys(presets.items).length);
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
