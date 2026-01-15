<!--
  メッセージダイアログ。
  QuasarのDialog Pluginから呼ぶことを想定。
  参照：https://quasar.dev/quasar-plugins/dialog
-->
<template>
  <BaseDialog
    ref="dialogRef"
    v-model:open="modelValue"
    :title
    :description="message"
    :icon="
      props.type !== 'info'
        ? { name: `sym_o_${iconName}`, color: color }
        : undefined
    "
    :persistent
    @update:open="handleOpenUpdate"
  >
    <div class="footer">
      <BaseButton :label="ok" @click="onOk" />
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import { computed } from "vue";
import { DialogType, getColor, getIcon } from "./common";
import BaseDialog from "@/components/Base/BaseDialog.vue";
import BaseButton from "@/components/Base/BaseButton.vue";

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

function handleOpenUpdate(isOpen: boolean) {
  if (!isOpen) {
    onDialogHide();
  }
}

function onOk() {
  onDialogOK();
}
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.footer {
  display: flex;
  justify-content: end;
  gap: vars.$gap-1;
}
</style>
