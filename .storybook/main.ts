import type { StorybookConfig } from "@storybook/vue3-vite";
import { assetsPath, dicPath } from "@/storybook/engineMock";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@chromatic-com/storybook",
    "@storybook/addon-interactions",
  ],
  core: {
    builder: "@storybook/builder-vite",
  },
  framework: {
    name: "@storybook/vue3-vite",
    options: {
      docgen: "vue-component-meta",
    },
  },
  staticDirs: [
    // モックエンジン用のファイル
    { from: "../node_modules/kuromoji/dict", to: dicPath },
    { from: "../tests/assets", to: assetsPath },
  ],
};

export default config;
