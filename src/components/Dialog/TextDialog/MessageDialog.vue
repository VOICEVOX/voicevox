<!--
  メッセージダイアログ。
  QuasarのDialog Pluginから呼ぶことを想定。
  参照：https://quasar.dev/quasar-plugins/dialog
-->
<template>
  <QDialog
    ref="dialogRef"
    v-model="modelValue"
    :persistent
    @hide="onDialogHide"
  >
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection class="title">
        <QIcon
          v-if="props.type !== 'info'"
          :name="`sym_o_${iconName}`"
          size="2rem"
          class="q-mr-sm"
          :color
        />
        <div class="text-h5">{{ props.title }}</div>
      </QCardSection>

      <QSeparator />

      <QCardSection class="message">
        {{ props.message }}
      </QCardSection>

      <QSeparator />

      <QCardActions align="right">
        <QBtn
          outline
          :label="props.ok"
          color="toolbar-button"
          textColor="toolbar-button-display"
          class="text-no-wrap text-bold q-mr-sm"
          @click="onOk"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import { computed } from "vue";
import { DialogType, getColor, getIcon } from "./common";

const modelValue = defineModel<boolean>({ default: false });
const props = withDefaults(
  defineProps<{
    type: DialogType;
    title: string;
    message: string;
    ok?: string;
    persistent?: boolean;
  }>(),
  {
    ok: "OK",
    persistent: true,
  },
);

defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const iconName = computed(() => getIcon(props.type));
const color = computed(() => getColor(props.type));
const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

function onOk() {
  onDialogOK();
}
</script>

<style scoped lang="scss">
.title {
  display: flex;
  align-items: center;
}

.message {
  white-space: pre-wrap;
}
</style>
