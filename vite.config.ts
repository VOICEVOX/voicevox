/// <reference types="vitest" />
import path from "path";
import type { UserConfig } from "vite";
import treeKill from "tree-kill";
import { rmSync } from "fs";

import electron from "vite-plugin-electron";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";

rmSync(path.resolve(__dirname, "dist"), { recursive: true, force: true });

const isElectron = process.env.VITE_IS_ELECTRON === "true";

const config: UserConfig = {
  root: path.resolve(__dirname, "src"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    chunkSizeWarningLimit: 10000,
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
          },
        },
      }),
  ],
};

export default config;
