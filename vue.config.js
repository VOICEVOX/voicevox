// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const process = require("process");

const VOICEVOX_ENGINE_DIR =
  process.env.VOICEVOX_ENGINE_DIR ?? "../voicevox_engine/run.dist/";

module.exports = {
  configureWebpack: {
    devtool: "source-map",
  },
  pluginOptions: {
    electronBuilder: {
      preload: "src/electron/preload.ts",
      builderOptions: {
        fileAssociations: [
          {
            ext: "vvproj",
            name: "VOICEVOX Project file",
            role: "Editor",
          },
        ],
        extraFiles: [
          { from: ".env.production", to: ".env" },
          {
            from: VOICEVOX_ENGINE_DIR,
            to: "",
          },
        ],
        // electron-builder installer
        productName: "VOICEVOX",
        appId: "jp.hiroshiba.voicevox",
        copyright: "Hiroshiba Kazuyuki",
        afterAllArtifactBuild: path.resolve(
          __dirname,
          "build",
          "afterAllArtifactBuild.js"
        ),
        win: {
          icon: "public/icon.png",
          target: [
            {
              target: "nsis-web",
              arch: ["x64"],
            },
          ],
        },
        directories: {
          buildResources: "build",
        },
        nsisWeb: {
          include: "build/installer.nsh",
          oneClick: false,
          allowToChangeInstallationDirectory: true,
        },
        publish: {
          provider: "github",
          repo: "voicevox",
          vPrefixedTagName: false,
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
