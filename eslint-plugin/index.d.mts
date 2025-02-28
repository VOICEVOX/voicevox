import { FlatConfig } from "@typescript-eslint/utils/ts-eslint";

declare const plugin: {
  configs: {
    all: FlatConfig.ConfigArray;
  };
};
export default plugin;
