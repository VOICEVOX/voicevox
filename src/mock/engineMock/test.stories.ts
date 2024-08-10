import { userEvent, within, expect, fn } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import { createOpenAPIEngineMock, mockHost } from "@/mock/engineMock";

const meta: Meta = {
  render: () => {
    return { template: "<div/>" };
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AudioQuery: Story = {
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

export const Synthesis: Story = {
  play: async ({ args }) => {
    const mockApi = createOpenAPIEngineMock();
    const api = mockApi.instance(mockHost);
    const audioQuery = await api.audioQueryAudioQueryPost({
      text: "そうです、そのとおりだと思いますね",
      speaker: 1,
    });
    const blob = await api.synthesisSynthesisPost({
      audioQuery,
      speaker: 1,
    });
    console.log(blob);
  },
};
