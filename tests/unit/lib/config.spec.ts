import pastConfigs from "./pastConfigs";
import { BaseConfig } from "@/infrastructures/Config";
import { configSchema } from "@/type/preload";

const configBase = {
  ...configSchema.parse({}),
  __internal__: {
    migrations: {
      version: "999.999.999",
    },
  },
};

class TestConfig extends BaseConfig {
  getVersion() {
    return "999.999.999";
  }

  exists() {
    throw new Error("mockで実装してください");

    // Unreachableだが、一応booleanを返さないとモックできないので返しておく。
    return false;
  }

  load() {
    throw new Error("mockで実装してください");

    return {} as ReturnType<BaseConfig["load"]>;
  }

  // VitestのmockFn.mock.callsの型のために引数を受け取るようにしている。
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  save(data: Parameters<BaseConfig["save"]>[0]) {
    throw new Error("mockで実装してください");
  }
}

it("新規作成できる", () => {
  vi.spyOn(TestConfig.prototype, "exists").mockImplementation(() => false);
  vi.spyOn(TestConfig.prototype, "save").mockImplementation(() => undefined);

  const config = new TestConfig();
  expect(config).toBeTruthy();
});

it("バージョンが保存される", () => {
  vi.spyOn(TestConfig.prototype, "exists").mockImplementation(() => false);
  const saveSpy = vi
    .spyOn(TestConfig.prototype, "save")
    .mockImplementation(() => undefined);

  new TestConfig();
  expect(saveSpy).toHaveBeenCalled();
  const savedData = saveSpy.mock.calls[0][0];
  expect(savedData.__internal__.migrations.version).toBe("999.999.999");
});

for (const [version, data] of pastConfigs) {
  it(`${version}からマイグレーションできる`, () => {
    vi.spyOn(TestConfig.prototype, "exists").mockImplementation(() => true);
    vi.spyOn(TestConfig.prototype, "save").mockImplementation(() => undefined);
    vi.spyOn(TestConfig.prototype, "load").mockImplementation(() => data);

    const config = new TestConfig();
    expect(config).toBeTruthy();
  });
}

it("getできる", () => {
  vi.spyOn(TestConfig.prototype, "exists").mockImplementation(() => true);
  vi.spyOn(TestConfig.prototype, "save").mockImplementation(() => undefined);
  vi.spyOn(TestConfig.prototype, "load").mockImplementation(() => ({
    ...configBase,
    inheritAudioInfo: false,
  }));

  const config = new TestConfig();
  expect(config.get("inheritAudioInfo")).toBe(false);
});

it("setできる", () => {
  vi.spyOn(TestConfig.prototype, "exists").mockImplementation(() => true);
  vi.spyOn(TestConfig.prototype, "save").mockImplementation(() => undefined);
  vi.spyOn(TestConfig.prototype, "load").mockImplementation(() => ({
    ...configBase,
    inheritAudioInfo: false,
  }));

  const config = new TestConfig();
  config.set("inheritAudioInfo", true);
  expect(config.get("inheritAudioInfo")).toBe(true);
});
