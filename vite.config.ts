/// <reference types="vitest" />
import path from "path";
import { BuildOptions, defineConfig } from "vite";
import treeKill from "tree-kill";
import { rmSync } from "fs";

import electron from "vite-plugin-electron";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import checker from "vite-plugin-checker";

rmSync(path.resolve(__dirname, "dist"), { recursive: true, force: true });

const isElectron = process.env.VITE_IS_ELECTRON === "true";

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  const sourcemap: BuildOptions["sourcemap"] = isDevelopment ? "inline" : false;
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
    },

    plugins: [
      vue(),
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
          onstart: (options) => {
            // @ts-expect-error vite-electron-pluginがprocess.electronAppを定義していない
            const pid = process.electronApp?.pid;
            if (pid) {
              treeKill(pid);
            }
            options.startup([".", "--no-sandbox"]);
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
