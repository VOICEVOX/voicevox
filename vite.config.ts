/// <reference types="vitest" />
/* eslint-disable no-console */
import path from "path";
import { createWriteStream } from "fs";
import { rm, mkdir } from "fs/promises";
import { pipeline } from "stream/promises";
import treeKill from "tree-kill";

import electron from "vite-plugin-electron";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import checker from "vite-plugin-checker";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { BuildOptions, defineConfig, loadEnv, Plugin } from "vite";
import { quasar } from "@quasar/vite-plugin";
import archiver from "archiver";

const isElectron = process.env.VITE_TARGET === "electron";
const isBrowser = process.env.VITE_TARGET === "browser";
const isVst = process.env.VITE_TARGET === "vst";

const packageName = process.env.npm_package_name;

export default defineConfig((options) => {
  const env = loadEnv(options.mode, __dirname);
  if (!packageName?.startsWith(env.VITE_APP_NAME)) {
    throw new Error(
      `"package.json"の"name":"${packageName}"は"VITE_APP_NAME":"${env.VITE_APP_NAME}"から始まっている必要があります`
    );
  }
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
  process.env.VITE_APP_VERSION = process.env.npm_package_version;
  const sourcemap: BuildOptions["sourcemap"] = shouldEmitSourcemap
    ? "inline"
    : false;
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
    test: {
      include: [
        path.resolve(__dirname, "tests/unit/**/*.spec.ts").replace(/\\/g, "/"),
      ],
      environment: "happy-dom",
      environmentMatchGlobs: [
        [
          path
            .resolve(__dirname, "tests/unit/backend/electron/**/*.spec.ts")
            .replace(/\\/g, "/"),
          "node",
        ],
      ],
      globals: true,
    },

    plugins: [
      vue(),
      quasar({ autoImportComponentCase: "pascal" }),
      nodePolyfills(),
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
        electron({
          entry: [
            "./src/backend/electron/main.ts",
            "./src/backend/electron/preload.ts",
          ],
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
      isBrowser && injectPreloadPlugin("browser"),
      isVst && [injectPreloadPlugin("vst"), createHeaderPlugin()],
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
      enforce: "pre" as const,
      transform: (html: string) =>
        html.replace(
          `<!-- %${name.toUpperCase()}_PRELOAD% -->`,
          `<script type="module" src="./backend/${name}/preload.ts"></script>`
        ),
    },
  };
};

const createHeaderPlugin = (): Plugin => {
  return {
    name: "create-header",
    apply: "build",
    enforce: "post",
    closeBundle: async () => {
      if (!packageName) {
        return;
      }

      console.log("Creating zip file...");
      const webOutput = path.join(__dirname, "dist");
      const vstOutput = path.join(__dirname, "dist_vst");
      await mkdir(vstOutput, { recursive: true });
      const archive = archiver("zip", {
        zlib: { level: 9 },
      });
      const zipName = `${packageName}.zip`;
      const zipPath = path.join(vstOutput, zipName);
      await rm(zipPath, { force: true });
      archive.directory(webOutput, false);
      archive.finalize();
      const outputZip = createWriteStream(zipPath);
      await pipeline(archive, outputZip);
      console.log(`Zip file created: ${zipPath}`);
      outputZip.close();
    },
  };
};
