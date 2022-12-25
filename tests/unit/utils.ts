import { VueWrapper } from "@vue/test-utils";
import { Component, ComponentPublicInstance } from "vue";

export const wrapQPage = (page: Component) => {
  return {
    template: `
      <q-layout>
        <q-page-container>
          <page />
        </q-page-container>
      </q-layout>
    `,
    components: {
      page,
    },
  };
};

export const waitTicks = async (
  wrapper: VueWrapper<ComponentPublicInstance>,
  ticks: number
) => {
  for (let i = 0; i < ticks; i++) {
    await wrapper.vm.$nextTick();
  }
};
