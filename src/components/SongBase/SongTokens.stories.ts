import type { Meta, StoryObj } from "@storybook/vue3-vite";

import SongTokenCatalog from "./SongTokenCatalog.vue";

/**
 * SongBaseのコンポーネントで共有するトークンの一覧。
 * 色は`song-colors.scss`、寸法などは`song-variables.scss`で定義している
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
