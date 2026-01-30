/// <reference types="vitest" />
import { execFileSync } from "node:child_process";
import path from "node:path";
import { rm } from "node:fs/promises";
import electronPlugin, { ElectronOptions } from "vite-plugin-electron";
import tsconfigPaths from "vite-tsconfig-paths";
import vue from "@vitejs/plugin-vue";
import electronDefaultImport from "electron";
import checker from "vite-plugin-checker";
import { BuildOptions, defineConfig, loadEnv, Plugin } from "vite";
import { quasar } from "@quasar/vite-plugin";
import { playwright as playwrightProvider } from "@vitest/browser-playwright";
import { z } from "zod";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import {
  checkSuspiciousImports,
  CheckSuspiciousImportsOptions,
  SourceFile,
} from "./tools/checkSuspiciousImports.js";

// @ts-expect-error electronをelectron環境外からimportするとelectronのファイルパスが得られる。
// https://github.com/electron/electron/blob/a95180e0806f4adba8009f46124b6bb4853ac0a6/npm/index.js
const electronPath = electronDefaultImport as string;

const nodeTestPaths = ["../tests/unit/**/*.node.{test,spec}.ts"];
const browserTestPaths = ["../tests/unit/**/*.browser.{test,spec}.ts"];
const normalTestPaths = ["../tests/unit/**/*.{test,spec}.ts"];

const isElectron = process.env.VITE_TARGET === "electron";
const isBrowser = process.env.VITE_TARGET === "browser";
const isProduction = process.env.NODE_ENV === "production";

const ignorePaths = (paths: string[]) => paths.map((path) => `!${path}`);

type ElectronTargetVersion = {
  node: string;
  chrome: string;
};
function getElectronTargetVersion(): ElectronTargetVersion {
  const result = execFileSync(
    electronPath,
    [path.join(import.meta.dirname, "build/getElectronVersion.mjs")],
    {
      encoding: "utf-8",
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    },
  );
  return JSON.parse(result) as { node: string; chrome: string };
}

export default defineConfig((options) => {
  const mode = z
    .enum(["development", "test", "production"])
    .parse(options.mode);

  const packageName = process.env.npm_package_name;
  const env = loadEnv(mode, import.meta.dirname);
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
    (mode !== "production"
      ? path.join(import.meta.dirname, "vendored", "7z") + path.sep
      : "") + sevenZipBinName;
  process.env.VITE_APP_VERSION = process.env.npm_package_version;

  const shouldEmitSourcemap = ["development", "test"].includes(mode);
  const sourcemap: BuildOptions["sourcemap"] = shouldEmitSourcemap
    ? "inline"
    : false;

  const electronTargetVersion = isElectron
    ? getElectronTargetVersion()
    : undefined;

  // ref: electronの起動をスキップしてデバッグ起動を軽くする
  const skipLaunchElectron =
    mode === "test" || process.env.SKIP_LAUNCH_ELECTRON === "1";

  return {
    root: path.resolve(import.meta.dirname, "src"),
    envDir: import.meta.dirname,
    build: {
      target: electronTargetVersion?.chrome,
      outDir: path.resolve(import.meta.dirname, "dist"),
      chunkSizeWarningLimit: 10000,
      sourcemap,
      rollupOptions: {
        input: {
          main: path.resolve(import.meta.dirname, "src/index.html"),
          welcome: path.resolve(import.meta.dirname, "src/welcome/index.html"),
        },
      },
    },
    publicDir: path.resolve(import.meta.dirname, "public"),
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: [path.resolve(import.meta.dirname, "node_modules")],
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
      mode !== "test" &&
        checker({
          overlay: false,
          vueTsc: true,
        }),
      isElectron && [
        cleanDistPlugin(),
        // TODO: 関数で切り出して共通化できる部分はまとめる
        electronPlugin([
          {
            entry: "./backend/electron/main.ts",

            // ref: https://github.com/electron-vite/vite-plugin-electron/pull/122
            onstart: ({ startup }) => {
              console.log("main process build is complete.");
              if (!skipLaunchElectron) {
                // ここのprocess.argvは以下のような形で渡ってくる：
                // ["node", ".../vite.js", (...vite用の引数...), "--", その他引数...]
                const args: string[] = [".", "--no-sandbox"];
                const doubleDashIndex = process.argv.indexOf("--");
                if (doubleDashIndex !== -1) {
                  args.push("--", ...process.argv.slice(doubleDashIndex + 1));
                }
                void startup(args);
              }
            },
            vite: {
              plugins: [
                tsconfigPaths({ root: import.meta.dirname }),
                isProduction && checkSuspiciousImportsPlugin({}),
              ],
              build: {
                target: electronTargetVersion?.node,
                outDir: path.resolve(import.meta.dirname, "dist"),
                sourcemap,
              },
            },
          },
          ...electronPreloadOptions(
            {
              skipLaunchElectron,
              sourcemap,
              electronTargetVersion,
            },
            {
              preload: "./src/backend/electron/renderer/preload.ts",
              welcomePreload: "./src/welcome/preload.ts",
            },
          ),
        ]),
      ],
      isElectron &&
        injectLoaderScriptPlugin(
          "./backend/electron/renderer/backendApiLoader.ts",
        ),
      isBrowser &&
        injectLoaderScriptPlugin("./backend/browser/backendApiLoader.ts"),
    ],

    test: {
      projects: [
        // Node.js環境
        {
          extends: "../vite.config.ts",
          test: {
            include: nodeTestPaths,
            name: "node",
            environment: "node",
            globals: true,
          },
        },

        // happy-domのエミュレート版ブラウザ環境
        {
          extends: "../vite.config.ts",
          plugins: [],
          test: {
            include: [
              ...normalTestPaths,
              ...ignorePaths(nodeTestPaths),
              ...ignorePaths(browserTestPaths),
            ],
            globals: true,
            name: "unit",
            environment: "happy-dom",
          },
        },

        // Chromiumブラウザ環境
        {
          extends: "../vite.config.ts",
          test: {
            include: browserTestPaths,
            globals: true,
            name: "browser",
            browser: {
              enabled: true,
              instances: [{ browser: "chromium" }],
              provider: playwrightProvider(),
              headless: true,
              api: 7158,
              ui: false,
            },
          },
        },

        // Storybook
        {
          extends: "../vite.config.ts",
          plugins: [
            storybookTest({
              storybookScript: "storybook --ci --port 7160",
              storybookUrl: "http://localhost:7160",
            }),
          ],
          resolve: {
            alias: {
              // NOTE: Storybookで`template:`指定を使うために必要
              vue: "vue/dist/vue.esm-bundler.js",
            },
          },
          test: {
            globals: true,
            name: "storybook",
            browser: {
              enabled: true,
              instances: [{ browser: "chromium" }],
              provider: playwrightProvider(),
              headless: true,
              api: 7159,
              ui: false,
            },
            isolate: false,
            setupFiles: ["./.storybook/vitest.setup.ts"],
          },
        },
      ],
    },
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

const electronPreloadOptions = (
  options: {
    skipLaunchElectron: boolean;
    sourcemap: BuildOptions["sourcemap"];
    electronTargetVersion: ElectronTargetVersion | undefined;
  },
  entries: Record<string, string>,
): ElectronOptions[] =>
  Object.entries(entries).map(
    ([name, entry]): ElectronOptions => ({
      onstart({ reload }) {
        if (!options.skipLaunchElectron) {
          reload();
        }
      },
      vite: {
        plugins: [
          tsconfigPaths({ root: import.meta.dirname }),
          isProduction && checkSuspiciousImportsPlugin({}),
        ],
        build: {
          outDir: path.resolve(import.meta.dirname, "dist"),
          sourcemap: options.sourcemap,
          target: options.electronTargetVersion?.node,
          rollupOptions: {
            input: {
              [name]: path.resolve(import.meta.dirname, entry),
            },
            output: {
              format: "cjs",
              inlineDynamicImports: true,
              entryFileNames: `[name].cjs`,
              chunkFileNames: `[name].cjs`,
              assetFileNames: `[name].[ext]`,
            },
          },
        },
      },
    }),
  );

/** バックエンドAPIをフロントエンドから実行するコードを注入する */
const injectLoaderScriptPlugin = (scriptPath: string): Plugin => {
  return {
    name: "inject-loader-script",
    transformIndexHtml: {
      order: "pre",
      handler: (html: string) => {
        return html.replace(
          "<!-- %LOADER_SCRIPT% -->",
          `<script type="module" src="${scriptPath}"></script>`,
        );
      },
    },
  };
};

const checkSuspiciousImportsPlugin = (
  options: CheckSuspiciousImportsOptions,
): Plugin => {
  return {
    name: "check-suspicious-imports",
    enforce: "post",
    apply: "build",
    writeBundle(_options, bundle) {
      const files: SourceFile[] = [];
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk") {
          files.push({ path: file, content: chunk.code });
        }
      }
      checkSuspiciousImports(files, options);
    },
  };
};
