// @ts-check

// Electron Builderの設定をTypeScriptで書くために用意したファイル。
// TypeScriptの設定を中継している。
// NOTE: 26.0.18でデフォルトでTypeScriptがサポートされるようになったため、26.0.18移行がlatestになったらこれを消す。

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createJiti } = require("jiti");

const jiti = createJiti(__filename);

module.exports = async () => {
  const loaded = await jiti.import(`${__dirname}/electronBuilderConfig.ts`, {
    default: true,
  });

  return loaded;
};
