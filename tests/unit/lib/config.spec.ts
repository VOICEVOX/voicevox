import pastConfigs from "./pastConfigs";
import { Config } from "@/infrastructures/Config";
import { configSchema } from "@/type/preload";

const configBase = {
  ...configSchema.parse({}),
  __internal__: {
    migrations: {
      version: "999.999.999",
    },
  },
};

class TestConfig extends Config {
  configExists() {
    throw new Error("mockで実装してください");

    // Unreachableだが、一応booleanを返さないとモックできないので返しておく。
    return false;
  }

  loadConfig() {
    throw new Error("mockで実装してください");

    return {} as ReturnType<Config["loadConfig"]>;
  }

  save() {
    throw new Error("mockで実装してください");
  }
}

it("新規作成できる", () => {
  TestConfig.prototype.configExists = vi.fn().mockReturnValue(false);
  TestConfig.prototype.save = vi.fn();
  const config = new TestConfig();
  expect(config).toBeTruthy();
});

for (const [version, data] of pastConfigs) {
  it(`${version}からマイグレーションできる`, () => {
    TestConfig.prototype.configExists = vi.fn().mockReturnValue(true);
    TestConfig.prototype.save = vi.fn();
    TestConfig.prototype.loadConfig = vi.fn().mockReturnValue(data);

    const config = new TestConfig();
    expect(config).toBeTruthy();
  });
}

it("getできる", () => {
  TestConfig.prototype.configExists = vi.fn().mockReturnValue(true);
  TestConfig.prototype.loadConfig = vi.fn().mockReturnValue({
    ...configBase,
    inheritAudioInfo: false,
  });
  TestConfig.prototype.save = vi.fn();

  const config = new TestConfig();
  expect(config.get("inheritAudioInfo")).toBe(false);
});

it("setできる", () => {
  TestConfig.prototype.configExists = vi.fn().mockReturnValue(true);
  TestConfig.prototype.loadConfig = vi.fn().mockReturnValue({
    ...configBase,
    inheritAudioInfo: false,
  });
  TestConfig.prototype.save = vi.fn();

  const config = new TestConfig();
  config.set("inheritAudioInfo", true);
  expect(config.get("inheritAudioInfo")).toBe(true);
});

it("deleteできる", () => {
  TestConfig.prototype.configExists = vi.fn().mockReturnValue(true);
  TestConfig.prototype.save = vi.fn();
  TestConfig.prototype.loadConfig = vi.fn().mockReturnValue({
    ...configBase,
    inheritAudioInfo: false,
  });

  const config = new TestConfig();
  config.delete("inheritAudioInfo");
  expect(config.get("inheritAudioInfo")).toBeUndefined();
});
