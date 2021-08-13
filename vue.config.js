// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

module.exports = {
  configureWebpack: {
    devtool: "source-map",
  },
  pluginOptions: {
    electronBuilder: {
      preload: "src/electron/preload.ts",
      builderOptions: {
        extraFiles: [
          { from: ".env.production", to: ".env" },
          {
            from: "../voicevox_engine/run.dist/",
            to: "",
          },
        ],
        // electron-builder installer
        productName: "VOICEVOX",
        appId: "jp.hiroshiba.voicevox",
        copyright: "Hiroshiba Kazuyuki",
        compression: "maximum",
        extends: null,
        win: {
          icon: "public/icon.png",
          target: [
            {
              target: "nsis-web",
              arch: ["x64"],
            },
          ],
        },
      },
    },
  },
  css: {
    loaderOptions: {
      sass: {
        sassOptions: {
          includePaths: [path.resolve(__dirname, "node_modules")],
        },
      },
    },
  },
};
