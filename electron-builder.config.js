const path = require("path");
const fs = require("fs");
const which = require("which");

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

let sevenZipPath = "";
if (process.platform === "win32") {
  sevenZipPath = "./build/7zr.exe";
} else {
  sevenZipPath = which.sync("7z");
}

// electron-builderのextraFilesは、ファイルのコピー先としてVOICEVOX.app/Contents/を使用する。
// しかし、実行ファイルはVOICEVOX.app/Contents/MacOS/にあるため、extraFilesをVOICEVOX.app/Contents/ディレクトリにコピーするのは正しくない。
// VOICEVOX.app/Contents/MacOS/ディレクトリにコピーされるように修正する。
// cf: https://k-hyoda.hatenablog.com/entry/2021/10/23/000349#%E8%BF%BD%E5%8A%A0%E5%B1%95%E9%96%8B%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E5%85%88%E3%81%AE%E8%A8%AD%E5%AE%9A
const extraFilePrefix = isMac ? "MacOS/" : "";

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
    {
      from: "build/README.txt",
      to: extraFilePrefix + "README.txt",
    },
    {
      from: ".env.production",
      to: extraFilePrefix + ".env",
    },
    {
      from: sevenZipPath,
      to: extraFilePrefix + (process.platform === "win32" ? "7zr.exe" : "7z"),
    },
    {
      from: VOICEVOX_ENGINE_DIR,
      to: extraFilePrefix,
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
