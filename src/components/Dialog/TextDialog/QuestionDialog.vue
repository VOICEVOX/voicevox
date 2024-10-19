<!--
  ブラウザ版の質問ダイアログ。
  QuasarのDialog Pluginから呼ぶことを想定。
  参照：https://quasar.dev/quasar-plugins/dialog
  WARNING: キャンセルしてもonCancelは呼ばれないので注意。
-->
<template>
  <QDialog
    ref="dialogRef"
    :modelValue
    :persistent
    @update:modelValue="updateModelValue"
  >
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

      <QCardSection class="q-py-none message">
        {{ props.message }}
      </QCardSection>
      <QCardActions align="right">
        <QSpace />
        <QBtn
          v-for="(button, index) in props.buttons"
          ref="buttons"
          :key="index"
          flat
          :label="button"
          color="toolbar-button"
          textColor="toolbar-button-display"
          class="text-no-wrap text-bold"
          @click="onClick(index)"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { QBtn, useDialogPluginComponent } from "quasar";
import { computed, onMounted, useTemplateRef } from "vue";
import { getIcon, getColor, DialogType } from "./common";
import { UnreachableError } from "@/type/utility";

const modelValue = defineModel<boolean>({ default: false });
const props = withDefaults(
  defineProps<{
    type: DialogType;
    title: string;
    message: string;
    buttons: string[];
    persistent?: boolean | undefined;
    default?: number | undefined;
    cancel?: number | undefined;
  }>(),
  {
    persistent: undefined,
    default: undefined,
    cancel: undefined,
  },
);
defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const iconName = computed(() => getIcon(props.type));
const color = computed(() => getColor(props.type));
const { dialogRef, onDialogOK } = useDialogPluginComponent();

const buttonsRef = useTemplateRef<QBtn[]>("buttons");
const persistent = computed(
  () => props.persistent ?? props.cancel == undefined,
);

onMounted(() => {
  if (props.default != undefined) {
    buttonsRef.value?.[props.default].$el.focus();
  }
  buttonClicked = false;
});

let buttonClicked = false;

const onClick = (index: number) => {
  if (buttonClicked) return;
  buttonClicked = true;
  onDialogOK({ index });
};

const updateModelValue = (val: boolean) => {
  // trueになるとき：通す
  // falseになるとき：
  // - onClickを呼んだ後に非表示になるなら通す
  // - そうでないなら（背景クリックなど）cancel扱いにする、cancelが未設定ならエラー（Unreachableのはず）
  // NOTE: ブラウザ版のバックエンドのダイアログとして利用しており、electronのDialogの仕様に合わせる必要があるので、処理がややこしくなっている
  if (val || buttonClicked) {
    modelValue.value = val;
  } else {
    if (props.cancel == undefined) {
      throw new UnreachableError(
        "Unreachable: cancel is not set, but dialog is not closed by clicking button",
      );
    }
    buttonClicked = true;
    // NOTE: ipc経由で出すダイアログの実装と揃えるため、onDialogOKでキャンセルを処理している
    // TODO: ipc経由でダイアログを出さずに全てブラウザ実装のダイアログを使うようにする
    onDialogOK({ index: props.cancel });
  }
};
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
