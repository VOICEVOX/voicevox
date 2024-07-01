/// <reference types="vitest" />
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

export default defineConfig((options) => {
  const packageName = process.env.npm_package_name;
  const env = loadEnv(options.mode, __dirname);
  if (!packageName?.startsWith(env.VITE_APP_NAME)) {
    throw new Error(
      `"package.json"の"name":"${packageName}"は"VITE_APP_NAME":"${env.VITE_APP_NAME}"から始まっている必要があります`,
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
      include: ["../tests/unit/**/*.spec.ts"],
      environment: "happy-dom",
      globals: true,
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
          },
          {
            // ref: https://electron-vite.github.io/guide/preload-not-split.html
            entry: "./src/backend/electron/preload.ts",
            onstart({ reload }) {
              reload();
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
      await rm(path.resolve(__dirname, "dist"), {
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
