import path from "path";
import type { UserConfig } from "vite";
import treeKill from "tree-kill";

import electron from "vite-plugin-electron";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";

const config: UserConfig = {
  root: path.resolve(__dirname, "src"),
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
      },
    }),
  ],
};

export default config;
