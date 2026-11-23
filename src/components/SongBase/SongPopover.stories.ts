import type { Meta, StoryObj } from "@storybook/vue3-vite";

import { TooltipProvider } from "reka-ui";
import SongIconButton from "./SongIconButton.vue";
import SongPopover from "./SongPopover.vue";

const meta: Meta<typeof SongPopover> = {
  component: SongPopover,
  render: (args) => ({
    components: { SongPopover, SongIconButton, TooltipProvider },
    setup() {
      return { args };
    },
    template: `
      <TooltipProvider>
        <SongPopover v-bind="args">
          <SongIconButton icon="tune" label="歌い方・声量・音域" />
          <template #content>
            <div style="display: flex; flex-direction: column; gap: 8px; width: 200px">
              <span>歌い方: 未設定</span>
              <span>声量: 0</span>
              <span>音域: 0</span>
            </div>
          </template>
        </SongPopover>
      </TooltipProvider>`,
  }),
};

export default meta;
type Story = StoryObj<typeof SongPopover>;

export const Default: Story = {};
