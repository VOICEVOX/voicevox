<template>
  <slot />
</template>

<script lang="ts">
import { defineComponent, Component, watch, ref } from "vue";
import { DialogChainObject, useQuasar } from "quasar";
import { useStore } from "../store";
import type { DialogContext, DialogName, DialogResult } from "../store/type";
import HotkeySettingDialog from "./HotkeySettingDialog.vue";
import DefaultStyleSelectDialog from "./DefaultStyleSelectDialog.vue";
import SettingDialog from "./SettingDialog.vue";
import HelpDialog from "./HelpDialog.vue";

type Dialogs = {
  [K in DialogName]: Component;
};

type DialogData = {
  dialogObject: DialogChainObject;
  context: DialogContext;
};

export default defineComponent({
  name: "DialogContainer",

  setup() {
    const store = useStore();
    const $q = useQuasar();

    const components: Dialogs = {
      HOTKEY_SETTING: HotkeySettingDialog,
      DEFAULT_STYLE_SELECT: DefaultStyleSelectDialog,
      SETTING: SettingDialog,
      HELP: HelpDialog,
    };

    let len = 0;

    const dialogs = ref<DialogData[]>([]);

    watch(store.state.dialogContexts, () => {
      if (store.state.dialogContexts.length > len) {
        // contextが増えたら新しくダイアログを開く
        const contexts = store.state.dialogContexts.filter(
          (ctx) => dialogs.value.map((x) => x.context).indexOf(ctx) === -1
        );

        for (const context of contexts) {
          dialogs.value.push({
            dialogObject: $q
              .dialog({
                component: components[context.dialog],
                componentProps: context.props,
              })
              .onOk((payload: DialogResult) => {
                context.result({ result: "ok", ...payload });
              })
              .onCancel((payload: DialogResult) => {
                context.result({ result: "cancel", ...payload });
              }),
            context,
          });
        }
      } else {
        // contextが減ったら減った分強制的に閉じる
        dialogs.value = dialogs.value.filter((x) => {
          if (store.state.dialogContexts.indexOf(x.context) > -1) return true;
          else x.dialogObject.hide();
        });
      }

      len = store.state.dialogContexts.length;
    });
  },
});
</script>
