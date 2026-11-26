import { ref } from "vue";
import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { TooltipProvider } from "reka-ui";
import SongIconButton from "./SongIconButton.vue";

const meta: Meta<typeof SongIconButton> = {
  component: SongIconButton,
  render: (args) => ({
    components: { SongIconButton, TooltipProvider },
    setup() {
      return { args };
    },
    template: `
    <TooltipProvider>
      <SongIconButton v-bind="args" />
    </TooltipProvider>`,
  }),
};

export default meta;
type Story = StoryObj<typeof SongIconButton>;

export const Default: Story = {
  args: {
    label: "元に戻す",
    icon: "undo",
  },
};

export const Small: Story = {
  args: {
    label: "元に戻す",
    icon: "undo",
    size: "small",
  },
};

export const Disabled: Story = {
  args: {
    label: "元に戻す",
    icon: "undo",
    disabled: true,
  },
};

/** ツールを選ぶボタン。選んでいるものにpressedを指定する */
export const Tool: Story = {
  render: () => ({
    components: { SongIconButton, TooltipProvider },
    setup() {
      const tool = ref("edit");
      return { tool };
    },
    template: `
    <TooltipProvider>
      <div style="display: flex; gap: 4px">
        <SongIconButton icon="arrow_selector_tool" label="選択" :pressed="tool === 'select'" @click="tool = 'select'" />
        <SongIconButton icon="edit" label="編集" :pressed="tool === 'edit'" @click="tool = 'edit'" />
        <SongIconButton icon="ink_eraser" label="消去" :pressed="tool === 'erase'" @click="tool = 'erase'" />
      </div>
    </TooltipProvider>`,
  }),
};

/** 設定のオン・オフを切り替えるボタン。variantをprimaryにする */
export const Toggle: Story = {
  render: () => ({
    components: { SongIconButton, TooltipProvider },
    setup() {
      const on = ref(true);
      return { on };
    },
    template: `
    <TooltipProvider>
      <SongIconButton icon="repeat" label="ループ" variant="primary" :pressed="on" @click="on = !on" />
    </TooltipProvider>`,
  }),
};
