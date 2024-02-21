<template>
  <help-dialog v-model="isHelpDialogOpenComputed" />
  <setting-dialog v-model="isSettingDialogOpenComputed" />
  <hotkey-setting-dialog v-model="isHotkeySettingDialogOpenComputed" />
  <tool-bar-custom-dialog v-model="isToolbarSettingDialogOpenComputed" />
  <character-order-dialog
    v-if="orderedAllCharacterInfos.length > 0"
    v-model="isCharacterOrderDialogOpenComputed"
    :character-infos="orderedAllCharacterInfos"
  />
  <default-style-list-dialog
    v-if="orderedTalkCharacterInfos.length > 0"
    v-model="isDefaultStyleSelectDialogOpenComputed"
    :character-infos="orderedTalkCharacterInfos"
  />
  <dictionary-manage-dialog v-model="isDictionaryManageDialogOpenComputed" />
  <engine-manage-dialog v-model="isEngineManageDialogOpenComputed" />
  <accept-retrieve-telemetry-dialog
    v-model="isAcceptRetrieveTelemetryDialogOpenComputed"
  />
  <accept-terms-dialog v-model="isAcceptTermsDialogOpenComputed" />
  <update-notification-dialog-container
    :can-open-dialog="canOpenNotificationDialog"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import HelpDialog from "@/components/Dialog/HelpDialog/HelpDialog.vue";
import SettingDialog from "@/components/Dialog/SettingDialog.vue";
import HotkeySettingDialog from "@/components/Dialog/HotkeySettingDialog.vue";
import ToolBarCustomDialog from "@/components/Dialog/ToolBarCustomDialog.vue";
import DefaultStyleListDialog from "@/components/Dialog/DefaultStyleListDialog.vue";
import CharacterOrderDialog from "@/components/Dialog/CharacterOrderDialog.vue";
import AcceptRetrieveTelemetryDialog from "@/components/Dialog/AcceptRetrieveTelemetryDialog.vue";
import AcceptTermsDialog from "@/components/Dialog/AcceptTermsDialog.vue";
import DictionaryManageDialog from "@/components/Dialog/DictionaryManageDialog.vue";
import EngineManageDialog from "@/components/Dialog/EngineManageDialog.vue";
import UpdateNotificationDialogContainer from "@/components/Dialog/UpdateNotificationDialog/Container.vue";
import { useStore } from "@/store";
import { filterCharacterInfosByStyleType } from "@/store/utility";

const props =
  defineProps<{
    isEnginesReady: boolean;
  }>();
const store = useStore();

// ライセンス表示
const isHelpDialogOpenComputed = computed({
  get: () => store.state.isHelpDialogOpen,
  set: (val) => store.dispatch("SET_DIALOG_OPEN", { isHelpDialogOpen: val }),
});

// 設定
const isSettingDialogOpenComputed = computed({
  get: () => store.state.isSettingDialogOpen,
  set: (val) => store.dispatch("SET_DIALOG_OPEN", { isSettingDialogOpen: val }),
});

// ショートカットキー設定
const isHotkeySettingDialogOpenComputed = computed({
  get: () => store.state.isHotkeySettingDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isHotkeySettingDialogOpen: val,
    }),
});

// ツールバーのカスタム設定
const isToolbarSettingDialogOpenComputed = computed({
  get: () => store.state.isToolbarSettingDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isToolbarSettingDialogOpen: val,
    }),
});

// 利用規約表示
const isAcceptTermsDialogOpenComputed = computed({
  get: () => store.state.isAcceptTermsDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isAcceptTermsDialogOpen: val,
    }),
});

// キャラクター並び替え
const orderedAllCharacterInfos = computed(
  () => store.getters.GET_ORDERED_ALL_CHARACTER_INFOS
);
const isCharacterOrderDialogOpenComputed = computed({
  get: () =>
    !store.state.isAcceptTermsDialogOpen &&
    store.state.isCharacterOrderDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isCharacterOrderDialogOpen: val,
    }),
});

// TODO: デフォルトスタイル選択(ソング)の実装
// デフォルトスタイル選択(トーク)
const orderedTalkCharacterInfos = computed(() => {
  return filterCharacterInfosByStyleType(
    store.getters.GET_ORDERED_ALL_CHARACTER_INFOS,
    "talk"
  );
});
const isDefaultStyleSelectDialogOpenComputed = computed({
  get: () =>
    !store.state.isAcceptTermsDialogOpen &&
    !store.state.isCharacterOrderDialogOpen &&
    store.state.isDefaultStyleSelectDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isDefaultStyleSelectDialogOpen: val,
    }),
});

// エンジン管理
const isEngineManageDialogOpenComputed = computed({
  get: () => store.state.isEngineManageDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isEngineManageDialogOpen: val,
    }),
});

// 読み方＆アクセント辞書
const isDictionaryManageDialogOpenComputed = computed({
  get: () => store.state.isDictionaryManageDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isDictionaryManageDialogOpen: val,
    }),
});

const isAcceptRetrieveTelemetryDialogOpenComputed = computed({
  get: () =>
    !store.state.isAcceptTermsDialogOpen &&
    !store.state.isCharacterOrderDialogOpen &&
    !store.state.isDefaultStyleSelectDialogOpen &&
    store.state.isAcceptRetrieveTelemetryDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isAcceptRetrieveTelemetryDialogOpen: val,
    }),
});

// エディタのアップデート確認ダイアログ
const canOpenNotificationDialog = computed(() => {
  return (
    !store.state.isAcceptTermsDialogOpen &&
    !store.state.isCharacterOrderDialogOpen &&
    !store.state.isDefaultStyleSelectDialogOpen &&
    !store.state.isAcceptRetrieveTelemetryDialogOpen &&
    props.isEnginesReady
  );
});
</script>
