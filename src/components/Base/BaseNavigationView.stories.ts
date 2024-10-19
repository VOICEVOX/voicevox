import type { Meta, StoryObj } from "@storybook/vue3";

import BaseNavigationView from "./BaseNavigationView.vue";
import BaseListItem from "./BaseListItem.vue";

const meta: Meta<typeof BaseNavigationView> = {
  component: BaseNavigationView,
};

export default meta;
type Story = StoryObj<typeof BaseNavigationView>;

export const Default: Story = {
  render: (args) => ({
    components: { BaseNavigationView, BaseListItem },
    setup() {
      return { args };
    },
    template: `
      <BaseNavigationView style="width: 100%; height:480px" v-bind="args">
        <template #sidebar>
          <BaseListItem selected>SelectedListItem</BaseListItem>
          <BaseListItem>ListItem</BaseListItem>
        </template>
        <div>Content</div>
      </BaseNavigationView>`,
  }),
};
