/// <reference types="vitest" />
import { defineWorkspace } from "vitest/config";
import { storybookTest } from "@storybook/experimental-addon-test/vitest-plugin";

const nodeTestPaths = ["../tests/unit/**/*.node.{test,spec}.ts"];
const browserTestPaths = ["../tests/unit/**/*.browser.{test,spec}.ts"];
const normalTestPaths = ["../tests/unit/**/*.{test,spec}.ts"];

const reversePaths = (paths: string[]) => paths.map((path) => `!${path}`);

export default defineWorkspace([
  {
    extends: "./vite.config.mts",
    test: {
      include: nodeTestPaths,
      name: "node",
      environment: "node",
      globals: true,
    },
  },
  {
    extends: "./vite.config.mts",
    plugins: [],
    test: {
      include: [
        ...normalTestPaths,
        ...reversePaths(nodeTestPaths),
        ...reversePaths(browserTestPaths),
      ],
      globals: true,
      name: "unit",
      environment: "happy-dom",
    },
  },
  {
    extends: "./vite.config.mts",
    test: {
      include: browserTestPaths,
      globals: true,
      name: "browser",
      browser: {
        enabled: true,
        name: "chromium",
        provider: "playwright",
        headless: true,
        api: 7158,
        ui: false,
      },
    },
  },
  {
    extends: "./vite.config.mts",

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
      include: ["./**/*.stories.ts"],
      globals: true,
      name: "storybook",
      browser: {
        enabled: true,
        name: "chromium",
        provider: "playwright",
        headless: true,
        api: 7159,
        ui: false,
      },
      isolate: false,
      setupFiles: ["./.storybook/vitest.setup.ts"],
    },
  },
]);
