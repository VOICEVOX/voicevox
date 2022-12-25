import { Component } from "vue";

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
