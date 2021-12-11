<template>
  <slot />
</template>

<script lang="ts">
import { defineComponent, Component, watch, ref } from "vue";
import { DialogChainObject, useQuasar } from "quasar";
import { useStore } from "@/store";
import type { DialogContext, DialogName, DialogResult } from "@/store/type";
import CommonDialog from "@/components/CommonDialog.vue";
import HotkeySettingDialog from "@/components/HotkeySettingDialog.vue";
import DefaultStyleSelectDialog from "@/components/DefaultStyleSelectDialog.vue";
import SettingDialog from "@/components/SettingDialog.vue";
import HelpDialog from "@/components/HelpDialog.vue";
import SaveAllResultDialog from "@/components/SaveAllResultDialog.vue";
import AcceptRetrieveTelemetryDialog from "@/components/AcceptRetrieveTelemetryDialog.vue";

type Dialogs = {
  [K in DialogName]: Component;
};

type DialogData = {
  dialogObject: DialogChainObject;
  context: DialogContext;
  closed?: boolean;
};

export default defineComponent({
  name: "DialogContainer",

  setup() {
    const store = useStore();
    const $q = useQuasar();

    const components: Dialogs = {
      COMMON: CommonDialog,
      HOTKEY_SETTING: HotkeySettingDialog,
      DEFAULT_STYLE_SELECT: DefaultStyleSelectDialog,
      SETTING: SettingDialog,
      HELP: HelpDialog,
      SAVE_ALL_RESULT: SaveAllResultDialog,
      ACCEPT_RETRIEVE_TELEMETRY: AcceptRetrieveTelemetryDialog,
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
          const dialogData: DialogData = {
            dialogObject: $q
              .dialog({
                component: components[context.dialog],
                componentProps: context.props,
              })
              .onOk((payload: DialogResult) => {
                dialogData.closed = true;
                context.result(payload);
              })
              .onCancel(() => {
                dialogData.closed = true;
                context.result();
              }),
            context,
          };
          dialogs.value.push(dialogData);
        }
      } else {
        // contextが減ったら減った分強制的に閉じる
        dialogs.value = dialogs.value.filter((x) => {
          if (store.state.dialogContexts.indexOf(x.context) > -1) return true;
          else if (!x.closed) x.dialogObject.hide();
        });
      }

      len = store.state.dialogContexts.length;
    });
  },
});
</script>
