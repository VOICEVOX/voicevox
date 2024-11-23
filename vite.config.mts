/// <reference types="vitest" />
import path from "path";
import { rm } from "fs/promises";

import electron from "vite-plugin-electron";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import checker from "vite-plugin-checker";
import { BuildOptions, defineConfig, loadEnv, Plugin } from "vite";
import { quasar } from "@quasar/vite-plugin";

const isElectron = process.env.VITE_TARGET === "electron";
const isBrowser = process.env.VITE_TARGET === "browser";

export default defineConfig((options) => {
  const packageName = process.env.npm_package_name;
  const env = loadEnv(options.mode, import.meta.dirname);
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
      ? path.join(import.meta.dirname, "build", "vendored", "7z") + path.sep
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
    root: path.resolve(import.meta.dirname, "src"),
    envDir: import.meta.dirname,
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      chunkSizeWarningLimit: 10000,
      sourcemap,
    },
    publicDir: path.resolve(import.meta.dirname, "public"),
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern",
          includePaths: [path.resolve(import.meta.dirname, "node_modules")],
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src/"),
      },
    },
    plugins: [
      vue(),
      quasar({ autoImportComponentCase: "pascal" }),
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
            entry: "./backend/electron/main.ts",
            // ref: https://github.com/electron-vite/vite-plugin-electron/pull/122
            onstart: ({ startup }) => {
              console.log("main process build is complete.");
              if (!skipLahnchElectron) {
                void startup([".", "--no-sandbox"]);
              }
            },
            vite: {
              plugins: [tsconfigPaths({ root: import.meta.dirname })],
              build: {
                outDir: path.resolve(import.meta.dirname, "dist"),
                sourcemap,
              },
            },
          },
          {
            // ref: https://electron-vite.github.io/guide/preload-not-split.html
            entry: "./backend/electron/preload.ts",
            onstart({ reload }) {
              if (!skipLahnchElectron) {
                reload();
              }
            },
            vite: {
              plugins: [tsconfigPaths({ root: import.meta.dirname })],
              build: {
                outDir: path.resolve(import.meta.dirname, "dist"),
                sourcemap,
                rollupOptions: {
                  output: { inlineDynamicImports: true },
                },
              },
            },
          },
        ]),
      ],
      isBrowser && injectBrowserPreloadPlugin(),
    ],
  };
});
const cleanDistPlugin = (): Plugin => {
  return {
    name: "clean-dist",
    apply: "build",
    enforce: "pre",
    async buildStart() {
      await rm(path.resolve(import.meta.dirname, "dist"), {
        recursive: true,
        force: true,
      });
    },
  };
};

const injectBrowserPreloadPlugin = (): Plugin => {
  return {
    name: "inject-browser-preload",
    transformIndexHtml: {
      order: "pre",
      handler: (html: string) =>
        html.replace(
          "<!-- %BROWSER_PRELOAD% -->",
          `<script type="module" src="./backend/browser/preload.ts"></script>`,
        ),
    },
  };
};
