/// <reference types="vitest" />
import path from "path";
import { rmSync, readdirSync, readFileSync } from "fs";
import treeKill from "tree-kill";

import electron from "vite-plugin-electron";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import checker from "vite-plugin-checker";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { BuildOptions, defineConfig } from "vite";
import { quasar } from "@quasar/vite-plugin";

rmSync(path.resolve(__dirname, "dist"), { recursive: true, force: true });

const isElectron = process.env.VITE_IS_ELECTRON === "true";

export default defineConfig((options) => {
  const shouldEmitSourcemap = ["development", "test"].includes(options.mode);
  process.env.VITE_7Z_BIN_NAME =
    (options.mode === "development"
      ? path.join(__dirname, "build", "vendored", "7z") + path.sep
      : "") +
    {
      win32: "7za.exe",
      linux: "7zzs",
      darwin: "7zz",
    }[process.platform];
  const sourcemap: BuildOptions["sourcemap"] = shouldEmitSourcemap
    ? "inline"
    : false;
  const themes = readdirSync(path.resolve(__dirname, "public/themes")).map(
    (themeFile: string) => {
      return JSON.parse(
        readFileSync(
          path.resolve(__dirname, "public/themes", themeFile),
          "utf-8"
        )
      );
    }
  );
  return {
    root: path.resolve(__dirname, "src"),
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
    test: {
      include: [
        path.resolve(__dirname, "tests/unit/**/*.spec.ts").replace(/\\/g, "/"),
      ],
      environment: "happy-dom",
      globals: true,
    },
    define: {
      __availableThemes: JSON.stringify(themes),
    },

    plugins: [
      vue(),
      quasar(),
      nodePolyfills(),
      options.mode !== "test" &&
        checker({
          overlay: false,
          eslint: {
            lintCommand: "eslint --ext .ts,.vue .",
          },
          typescript: true,
          // FIXME: vue-tscの型エラーを解決したら有効化する
          // vueTsc: true,
        }),
      isElectron &&
        electron({
          entry: ["./src/background.ts", "./src/electron/preload.ts"],
          // ref: https://github.com/electron-vite/vite-plugin-electron/pull/122
          onstart: ({ startup }) => {
            // @ts-expect-error vite-electron-pluginはprocess.electronAppにelectronのプロセスを格納している。
            //   しかし、型定義はないので、ts-expect-errorで回避する。
            const pid = process.electronApp?.pid;
            if (pid) {
              treeKill(pid);
            }
            if (options.mode !== "test") {
              startup([".", "--no-sandbox"]);
            }
          },
          vite: {
            plugins: [tsconfigPaths({ root: __dirname })],
            build: {
              outDir: path.resolve(__dirname, "dist"),
              sourcemap,
            },
          },
        }),
    ],
  };
});
