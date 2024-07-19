/**
 * Vue で emit されるイベントを Storybook の Controls に表示するための argTypesEnhancer
 * https://zenn.dev/shota_kamezawa/articles/36cd647264656c#storybook-%E3%81%AE%E8%A8%AD%E5%AE%9A
 */

import { toHandlerKey } from "vue";
import { type ArgTypesEnhancer, type StrictInputType } from "@storybook/types";

export const addActionsWithEmits: ArgTypesEnhancer = ({ argTypes }) => {
  const argTypesEntries = Object.entries(argTypes)
    .filter(([, argType]) => argType.table?.category === "events")
    .map(([name]) => {
      /**
       * 例：`click` という events に対して `onClick` という名称の argType + action を追加することで、
       * v-on によるイベントのバインディングが可能となる
       * @see https://ja.vuejs.org/guide/extras/render-function.html#v-on
       */
      const newName = toHandlerKey(name);
      const newArgType: StrictInputType = {
        name: newName,
        action: name,
        table: {
          disable: true, // Controls には表示しない
        },
      };

      return [newName, newArgType] as const;
    });

  return {
    ...argTypes,
    ...Object.fromEntries(argTypesEntries),
  };
};
