/// <reference types="vitest" />
/* eslint-disable no-console */
import path from "path";
import { rm } from "fs/promises";
import { fileURLToPath } from "url";

import electron from "vite-plugin-electron";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import checker from "vite-plugin-checker";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { BuildOptions, defineConfig, loadEnv, Plugin } from "vite";
import { quasar } from "@quasar/vite-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isElectron = process.env.VITE_TARGET === "electron";
const isBrowser = process.env.VITE_TARGET === "browser";
const isVst = process.env.VITE_TARGET === "vst";

const packageName = process.env.npm_package_name;

export default defineConfig((options) => {
  const env = loadEnv(options.mode, __dirname);
  if (!packageName?.startsWith(env.VITE_APP_NAME)) {
    throw new Error(
      `"package.json"の"name":"${packageName}"は"VITE_APP_NAME":"${env.VITE_APP_NAME}"から始まっている必要があります`,
    );
  }

  // 型を曖昧にして下の[process.platform]のエラーを回避する
  const sevenZipBinNames: Record<string, string> = {
    win32: "7za.exe",
    linux: "7zzs",
    darwin: "7zz",
  };
  const sevenZipBinName = sevenZipBinNames[process.platform];
  if (!sevenZipBinName) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
  process.env.VITE_7Z_BIN_NAME =
    (options.mode === "development"
      ? path.join(__dirname, "build", "vendored", "7z") + path.sep
      : "") + sevenZipBinName;
  process.env.VITE_APP_VERSION = process.env.npm_package_version;

  const shouldEmitSourcemap = ["development", "test"].includes(options.mode);
  const sourcemap: BuildOptions["sourcemap"] = shouldEmitSourcemap
    ? "inline"
    : false;

  // ref: electronの起動をスキップしてデバッグ起動を軽くする
  const skipLahnchElectron =
    options.mode === "test" || process.env.SKIP_LAUNCH_ELECTRON === "1";

  return {
    root: path.resolve(__dirname, "src"),
    envDir: __dirname,
    build: {
      outDir: path.resolve(__dirname, "dist"),
      chunkSizeWarningLimit: 10000,
      sourcemap,
    },
    publicDir: path.resolve(__dirname, "public"),
    css: {
      preprocessorOptions: {
        scss: {
          includePaths: [path.resolve(__dirname, "node_modules")],
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src/"),
      },
    },
    plugins: [
      vue(),
      quasar({ autoImportComponentCase: "pascal" }),
      nodePolyfills({
        include: ["path"],
      }),
      options.mode !== "test" &&
        checker({
          overlay: false,
          eslint: {
            lintCommand: "eslint --ext .ts,.vue .",
          },
          vueTsc: true,
        }),
      isElectron && [
        cleanDistPlugin(),
        electron([
          {
            entry: "./src/backend/electron/main.ts",
            // ref: https://github.com/electron-vite/vite-plugin-electron/pull/122
            onstart: ({ startup }) => {
              console.log("main process build is complete.");
              if (!skipLahnchElectron) {
                void startup([".", "--no-sandbox"]);
              }
            },
            vite: {
              plugins: [tsconfigPaths({ root: __dirname })],
              build: {
                outDir: path.resolve(__dirname, "dist"),
                sourcemap,
              },
            },
          },
          {
            // ref: https://electron-vite.github.io/guide/preload-not-split.html
            entry: "./src/backend/electron/preload.ts",
            onstart({ reload }) {
              if (!skipLahnchElectron) {
                reload();
              }
            },
            vite: {
              plugins: [tsconfigPaths({ root: __dirname })],
              build: {
                outDir: path.resolve(__dirname, "dist"),
                sourcemap,
                rollupOptions: {
                  output: { inlineDynamicImports: true },
                },
              },
            },
          },
        ]),
      ],
      isBrowser && injectPreloadPlugin("browser"),
      isVst && injectPreloadPlugin("vst"),
    ],
  };
});
const cleanDistPlugin = (): Plugin => {
  return {
    name: "clean-dist",
    apply: "build",
    enforce: "pre",
    async buildStart() {
      await rm(path.resolve(__dirname, "dist"), {
        recursive: true,
        force: true,
      });
    },
  };
};

const injectPreloadPlugin = (name: string): Plugin => {
  return {
    name: "inject-browser-preload",
    transformIndexHtml: {
      order: "pre",
      handler: (html: string) =>
        html.replace(
          `<!-- %PRELOAD% -->`,
          `<script type="module" src="./backend/${name}/preload.ts"></script>`,
        ),
    },
  };
};
