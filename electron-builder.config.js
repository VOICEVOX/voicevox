const path = require("path");
const fs = require("fs");

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

const isMac = process.platform === "darwin";

/** @type {import("electron-builder").Configuration} */
const builderOptions = {
  beforeBuild: async () => {
    if (fs.existsSync(path.resolve(__dirname, "dist_electron"))) {
      fs.rmSync(path.resolve(__dirname, "dist_electron"), { recursive: true });
    }
  },
  directories: {
    output: "dist_electron",
    buildResources: "build",
  },
  files: ["dist/**/*", "package.json"],
  fileAssociations: [
    {
      ext: "vvproj",
      name: "VOICEVOX Project file",
      description: "VOICEVOX Project file",
      role: "Editor",
      icon: "icons/vvproj." + (isMac ? "icns" : "ico"),
    },
    {
      ext: "vvpp",
      name: "VOICEVOX Plugin package",
      description: "VOICEVOX Plugin package",
      role: "Editor",
      icon: "icons/vvpp." + (isMac ? "icns" : "ico"),
    },
    {
      ext: "vvppp",
      name: "VOICEVOX Plugin package (part)",
      description: "VOICEVOX Plugin package (part)",
      role: "Editor",
      icon: "icons/vvpp." + (isMac ? "icns" : "ico"),
    },
  ],
  extraFiles: [
    { from: "build/README.txt", to: "README.txt" },
    {
      from: ".env.production",
      to: ".env",
    },
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
    artifactName: LINUX_ARTIFACT_NAME !== "" ? LINUX_ARTIFACT_NAME : undefined,
    executableName:
      LINUX_EXECUTABLE_NAME !== "" ? LINUX_EXECUTABLE_NAME : undefined,
    icon: "public/icon.png",
    category: "AudioVideo",
    mimeTypes: ["application/x-voicevox"],
    target: [
      {
        target: "AppImage",
        arch: ["x64"],
      },
    ],
  },
  mac: {
    artifactName: MACOS_ARTIFACT_NAME !== "" ? MACOS_ARTIFACT_NAME : undefined,
    icon: "public/icon-mac.png",
    category: "public.app-category.utilities",
    target: [
      {
        target: "dmg",
        arch: ["x64"],
      },
    ],
  },
  dmg: {
    icon: "public/icon-dmg.icns",
  },
};

module.exports = builderOptions;
