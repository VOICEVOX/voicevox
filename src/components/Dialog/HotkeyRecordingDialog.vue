<template>
  <QDialog
    noEscDismiss
    noShake
    transitionShow="none"
    transitionHide="none"
    :modelValue="isHotkeyDialogOpened"
    @update:modelValue="closeHotkeyDialog"
  >
    <QCard class="q-py-sm q-px-md">
      <QCardSection align="center">
        <div class="text-h6">ショートカットキーを入力してください</div>
      </QCardSection>
      <QCardSection align="center">
        <template v-for="(hotkey, index) in lastRecord.split(' ')" :key="index">
          <span v-if="index !== 0"> + </span>
          <!--
          Mac の Meta キーは Cmd キーであるため、Meta の表示名を Cmd に置換する
          Windows PC では Meta キーは Windows キーだが、使用頻度低と考えられるため暫定的に Mac 対応のみを考慮している
          -->
          <QChip :ripple="false" color="surface">
            {{ hotkey === "Meta" ? "Cmd" : hotkey }}
          </QChip>
        </template>
        <span v-if="lastRecord !== '' && confirmBtnEnabled"> +</span>
        <div v-if="duplicatedHotkey != undefined" class="text-warning q-mt-lg">
          <div class="text-warning">
            ショートカットキーが次の操作と重複しています
          </div>
          <div class="q-mt-sm text-weight-bold text-warning">
            「{{ duplicatedHotkey.action }}」
          </div>
        </div>
      </QCardSection>
      <QCardActions align="center">
        <QBtn
          padding="xs md"
          label="キャンセル"
          unelevated
          color="surface"
          textColor="display"
          class="q-mt-sm"
          @click="closeHotkeyDialog"
        />
        <QBtn
          padding="xs md"
          label="ショートカットキーを未割り当てにする"
          unelevated
          color="surface"
          textColor="display"
          class="q-mt-sm"
          @click="
            emit('deleteHotkey', props.lastAction);
            closeHotkeyDialog();
          "
        />
        <QBtn
          v-if="duplicatedHotkey == undefined"
          padding="xs md"
          label="OK"
          unelevated
          color="primary"
          textColor="display-on-primary"
          class="q-mt-sm"
          :disabled="confirmBtnEnabled"
          @click="changeHotkeyAndClose"
        />
        <QBtn
          v-else
          padding="xs md"
          label="上書きする"
          unelevated
          color="primary"
          textColor="display-on-primary"
          class="q-mt-sm"
          :disabled="confirmBtnEnabled"
          @click="overwriteHotkeyAndClose"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { HotkeyCombination } from "@/domain/hotkeyAction";

const props = defineProps<{
  isHotkeyDialogOpened: boolean;
  lastAction: string;
  lastRecord: HotkeyCombination;
  duplicatedHotkey?: { action: string };
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "deleteHotkey", action: string): void;
  (
    e: "changeHotkeySettings",
    action: string,
    combination: HotkeyCombination,
  ): void;
}>();

const confirmBtnEnabled = computed(() => {
  return (
    props.lastRecord == "" ||
    ["Ctrl", "Shift", "Alt", "Meta"].includes(
      props.lastRecord.split(" ")[props.lastRecord.split(" ").length - 1],
    )
  );
});

const closeHotkeyDialog = () => {
  emit("update:modelValue", false);
};

const changeHotkeyAndClose = () => {
  emit("changeHotkeySettings", props.lastAction, props.lastRecord);
  closeHotkeyDialog();
};

const overwriteHotkeyAndClose = () => {
  if (props.duplicatedHotkey == undefined)
    throw new Error("props.duplicatedHotkey == undefined");
  emit("deleteHotkey", props.duplicatedHotkey.action);
  changeHotkeyAndClose();
};
</script>
