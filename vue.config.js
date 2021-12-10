// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const process = require("process");

const VOICEVOX_ENGINE_DIR =
  process.env.VOICEVOX_ENGINE_DIR ?? "../voicevox_engine/run.dist/";

// ${productName} Web Setup ${version}.${ext}
const NSIS_WEB_ARTIFACT_NAME = process.env.NSIS_WEB_ARTIFACT_NAME;

// ${productName}-${version}.${ext}
const LINUX_ARTIFACT_NAME = process.env.LINUX_ARTIFACT_NAME;

// ${packageName}
const LINUX_EXECUTABLE_NAME = process.env.LINUX_EXECUTABLE_NAME;

// ${productName}-${version}.${ext}
const MACOS_ARTIFACT_NAME = process.env.MACOS_ARTIFACT_NAME;

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
          { from: "build/README.txt", to: "README.txt" },
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
          artifactName:
            NSIS_WEB_ARTIFACT_NAME !== "" ? NSIS_WEB_ARTIFACT_NAME : undefined,
          include: "build/installer.nsh",
          oneClick: false,
          allowToChangeInstallationDirectory: true,
        },
        publish: {
          provider: "github",
          repo: "voicevox",
          vPrefixedTagName: false,
        },
        linux: {
          artifactName:
            LINUX_ARTIFACT_NAME !== "" ? LINUX_ARTIFACT_NAME : undefined,
          executableName:
            LINUX_EXECUTABLE_NAME !== "" ? LINUX_EXECUTABLE_NAME : undefined,
          icon: "public/icon.png",
          category: "AudioVideo",
          target: [
            {
              target: "AppImage",
              arch: ["x64"],
            },
          ],
        },
        mac: {
          artifactName:
            MACOS_ARTIFACT_NAME !== "" ? MACOS_ARTIFACT_NAME : undefined,
          icon: "public/icon.png",
          category: "public.app-category.utilities",
          target: [
            {
              target: "dmg",
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
