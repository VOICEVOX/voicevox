import { QPageContainer, QLayout } from "quasar";
import { Component } from "vue";

// QPageContainerとQLayoutで囲うためのヘルパー関数。
// QPageはQLayout > QPageContainer > QPageの構造にしないとエラーになるため必要。
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
      QPageContainer,
      QLayout,
    },
  };
};
