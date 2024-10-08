<!--
  ブラウザ版のメッセージダイアログ。
  QuasarのDialog Pluginから呼ぶことを想定。
  参照：https://quasar.dev/quasar-plugins/dialog
-->
<template>
  <QDialog ref="dialogRef" v-model="modelValue" @hide="onDialogHide">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection class="title">
        <QIcon
          v-if="props.type !== 'none'"
          :name="iconName"
          class="text-h5 q-mr-sm"
          :color
        />
        <div class="text-h5" :class="[`text-${color}`]">{{ props.title }}</div>
      </QCardSection>

      <QCardSection>
        {{ props.message }}
      </QCardSection>
      <QCardActions align="right">
        <QBtn
          unelevated
          label="OK"
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
import { getColor, getIcon } from "./common";

const modelValue = defineModel<boolean>({ default: false });
const props = defineProps<{
  type: "none" | "info" | "error" | "question" | "warning";
  title: string;
  message: string;
}>();

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
</style>
