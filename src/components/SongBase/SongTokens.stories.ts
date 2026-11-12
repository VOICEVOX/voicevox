import type { Meta, StoryObj } from "@storybook/vue3-vite";

import SongTokenCatalog from "./SongTokenCatalog.vue";

/**
 * ソングの部品(SongBase)で共有するトークンの一覧。
 * 色は `song-colors.scss` のCSS変数、寸法などは `song-variables.scss` のSCSS変数
 */
const meta: Meta<typeof SongTokenCatalog> = {
  component: SongTokenCatalog,
};

export default meta;
type Story = StoryObj<typeof SongTokenCatalog>;

export const Colors: Story = {
  args: { section: "colors" },
};

export const Sizes: Story = {
  args: { section: "sizes" },
};

export const Spaces: Story = {
  args: { section: "spaces" },
};

export const Radii: Story = {
  args: { section: "radii" },
};

export const Typography: Story = {
  args: { section: "typography" },
};
