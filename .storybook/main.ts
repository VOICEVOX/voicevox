import type { StorybookConfig } from "@storybook/vue3-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],

  addons: [
    "@storybook/addon-links",
    "@chromatic-com/storybook",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
    "@storybook/addon-docs",
  ],

  framework: {
    name: "@storybook/vue3-vite",
    options: {
      docgen: "vue-component-meta",
    },
  },
};

export default config;
