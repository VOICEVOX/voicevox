import { userEvent, within, expect, fn } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import { createOpenAPIEngineMock, mockHost } from "@/storybook/engineMock";

const meta: Meta = {
  render: () => {
    return { template: "<div/>" };
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenOfficialSite: Story = {
  name: "公式サイトを開くボタンを押す",
  play: async ({ args }) => {
    const mockApi = createOpenAPIEngineMock();
    const api = mockApi.instance(mockHost);
    const result = await api.audioQueryAudioQueryPost({
      text: "そうです、そのとおりだと思いますね",
      speaker: 1,
    });
    console.log(result);
  },
};
