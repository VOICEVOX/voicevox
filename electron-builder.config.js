// @ts-check
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

const dotenvPath = path.join(process.cwd(), ".env.production");
dotenv.config({ path: dotenvPath });

const VOICEVOX_ENGINE_DIR =
  process.env.VOICEVOX_ENGINE_DIR ?? "../voicevox_engine/dist/run/";

// ${productName} Web Setup ${version}.${ext}
const NSIS_WEB_ARTIFACT_NAME = process.env.NSIS_WEB_ARTIFACT_NAME;

// ${productName}-${version}.${ext}
const LINUX_ARTIFACT_NAME = process.env.LINUX_ARTIFACT_NAME;

// ${packageName}
const LINUX_EXECUTABLE_NAME = process.env.LINUX_EXECUTABLE_NAME;

// ${productName}-${version}.${ext}
const MACOS_ARTIFACT_NAME = process.env.MACOS_ARTIFACT_NAME;

// コード署名証明書
const WIN_CERTIFICATE_SHA1 = process.env.WIN_CERTIFICATE_SHA1;
const WIN_SIGNING_HASH_ALGORITHMS = process.env.WIN_SIGNING_HASH_ALGORITHMS
  ? JSON.parse(process.env.WIN_SIGNING_HASH_ALGORITHMS)
  : undefined;

const isMac = process.platform === "darwin";

const isArm64 = process.arch === "arm64";

// electron-builderのextraFilesは、ファイルのコピー先としてVOICEVOX.app/Contents/を使用する。
// しかし、実行ファイルはVOICEVOX.app/Contents/MacOS/にあるため、extraFilesをVOICEVOX.app/Contents/ディレクトリにコピーするのは正しくない。
// VOICEVOX.app/Contents/MacOS/ディレクトリにコピーされるように修正する。
// cf: https://k-hyoda.hatenablog.com/entry/2021/10/23/000349#%E8%BF%BD%E5%8A%A0%E5%B1%95%E9%96%8B%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E5%85%88%E3%81%AE%E8%A8%AD%E5%AE%9A
const extraFilePrefix = isMac ? "MacOS/" : "";

const sevenZipFile = fs
  .readdirSync(path.resolve(__dirname, "vendored", "7z"))
  .find(
    // Windows: 7za.exe, Linux: 7zzs, macOS: 7zz
    (fileName) => ["7za.exe", "7zzs", "7zz"].includes(fileName),
  );

if (!sevenZipFile) {
  throw new Error(
    "7z binary file not found. Run `node ./tools/download7z.js` first.",
  );
}

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
      from: VOICEVOX_ENGINE_DIR,
      to: path.join(extraFilePrefix, "vv-engine"),
    },
    {
      from: path.resolve(__dirname, "vendored", "7z", sevenZipFile),
      to: extraFilePrefix + sevenZipFile,
    },
  ],
  // electron-builder installer
  productName: "VOICEVOX",
  appId: "jp.hiroshiba.voicevox",
  copyright: "Hiroshiba Kazuyuki",
  afterAllArtifactBuild: path.resolve(
    __dirname,
    "build",
    "afterAllArtifactBuild.js",
  ),
  win: {
    icon: "public/icon.png",
    target: [
      {
        target: "nsis-web",
        arch: ["x64"],
      },
    ],
    certificateSha1:
      WIN_CERTIFICATE_SHA1 !== "" ? WIN_CERTIFICATE_SHA1 : undefined,
    signingHashAlgorithms:
      WIN_SIGNING_HASH_ALGORITHMS !== ""
        ? WIN_SIGNING_HASH_ALGORITHMS
        : undefined,
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
        arch: [isArm64 ? "arm64" : "x64"],
      },
    ],
  },
  dmg: {
    icon: "public/icon-dmg.icns",
  },
};

module.exports = builderOptions;
