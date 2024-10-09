import { defineWorkspace, mergeConfig } from "vitest/config";
import { defineConfig } from "vite";
import { storybookTest } from "@storybook/experimental-addon-test/vitest-plugin";
import baseViteConfig from "./vite.config.mjs";

export default defineWorkspace([
  defineConfig((mode) =>
    mergeConfig(baseViteConfig(mode), {
      test: {
        include: ["../tests/unit/**/*.node.{test,spec}.ts"],
        name: "node",
        environment: "node",
        globals: true,
      },
    }),
  ),
  defineConfig((mode) =>
    mergeConfig(baseViteConfig(mode), {
      plugins: [],
      test: {
        include: [
          "../tests/unit/**/*.{test,spec}.ts",
          "!../tests/unit/**/*.node.{test,spec}.ts",
        ],
        globals: true,
        name: "unit",
        environment: "happy-dom",
      },
    }),
  ),
  defineConfig((mode) =>
    mergeConfig(baseViteConfig(mode), {
      plugins: [
        storybookTest({
          storybookScript: "npm run storybook -- --ci",
        }),
      ],
      resolve: {
        alias: {
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
          headless: false,
        },
        isolate: false,
        setupFiles: ["./.storybook/vitest.setup.ts"],
      },
    }),
  ),
]);
