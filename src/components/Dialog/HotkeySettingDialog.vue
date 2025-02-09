<template>
  <QDialog
    v-model="hotkeySettingDialogOpenComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="hotkey-setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <QToolbarTitle class="text-display"
            >設定 / キー割り当て</QToolbarTitle
          >
          <QInput
            v-model="hotkeyFilter"
            hideBottomSpace
            dense
            placeholder="検索"
            color="display"
            class="q-mr-sm search-box"
          >
            <template #prepend>
              <QIcon name="search" />
            </template>
            <template #append>
              <QIcon
                v-if="hotkeyFilter !== ''"
                name="close"
                class="cursor-pointer"
                @click="hotkeyFilter = ''"
              />
              <QIcon v-else />
            </template>
          </QInput>
          <QBtn
            round
            flat
            icon="close"
            color="display"
            @click="hotkeySettingDialogOpenComputed = false"
          />
        </QToolbar>
      </QHeader>

      <QPageContainer>
        <QPage>
          <div class="container">
            <BaseScrollArea>
              <div class="table">
                <div class="table-header">
                  <div class="table-cell"></div>
                  <div class="table-cell">操作</div>
                  <div class="table-cell">ショートカットキー</div>
                </div>
                <div
                  v-for="hotkeySetting in hotkeySettings.filter(
                    (hotkeySetting) =>
                      hotkeySetting.action.includes(hotkeyFilter) ||
                      hotkeySetting.combination
                        .toLocaleLowerCase()
                        .includes(hotkeyFilter.toLocaleLowerCase()),
                  )"
                  :key="hotkeySetting.action"
                  class="table-row"
                >
                  <div class="table-cell"></div>
                  <div class="table-cell hotkey-name">
                    {{ hotkeySetting.action }}
                  </div>
                  <div class="table-cell key-button">
                    <BaseButton
                      :label="
                        getHotkeyText(
                          hotkeySetting.action,
                          hotkeySetting.combination,
                        )
                          .split(' ')
                          .map((hotkeyText) => {
                            // Mac の Meta キーは Cmd キーであるため、Meta の表示名を Cmd に置換する
                            // Windows PC では Meta キーは Windows キーだが、使用頻度低と考えられるため暫定的に Mac 対応のみを考慮している
                            return hotkeyText === 'Meta' ? 'Cmd' : hotkeyText;
                          })
                          .join(' + ')
                      "
                      :disabled="checkHotkeyReadonly(hotkeySetting.action)"
                      @click="openHotkeyDialog(hotkeySetting.action)"
                    />
                  </div>
                  <div class="table-cell icon-buttons">
                    <BaseIconButton
                      icon="settings_backup_restore"
                      label="デフォルトに戻す"
                      :disabled="
                        checkHotkeyReadonly(hotkeySetting.action) ||
                        isDefaultCombination(hotkeySetting.action)
                      "
                      @click="resetHotkey(hotkeySetting.action)"
                    />
                  </div>
                  <div class="table-cell"></div>
                </div>
              </div>
            </BaseScrollArea>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>

  <HotkeyRecordingDialog
    :isHotkeyDialogOpened
    :lastAction
    :lastRecord
    :duplicatedHotkey
    @update:modelValue="setHotkeyDialogOpened"
    @deleteHotkey="deleteHotkey"
    @changeHotkeySettings="changeHotkeySettings"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import HotkeyRecordingDialog from "./HotkeyRecordingDialog.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import { useStore } from "@/store";
import { useHotkeyManager, eventToCombination } from "@/plugins/hotkeyPlugin";
import {
  HotkeyCombination,
  HotkeyActionNameType,
  getDefaultHotkeySettings,
} from "@/domain/hotkeyAction";
import { isMac } from "@/helpers/platform";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const store = useStore();

const hotkeySettingDialogOpenComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const isHotkeyDialogOpened = ref(false);

const hotkeyFilter = ref("");

const hotkeySettings = computed(() => store.state.hotkeySettings);

const lastAction = ref("");
const lastRecord = ref(HotkeyCombination(""));

// FIXME: HotkeyRecordingDialog内に移動する
const recordCombination = (event: KeyboardEvent) => {
  if (!isHotkeyDialogOpened.value) {
    return;
  }

  const recordedCombo = eventToCombination(event);
  lastRecord.value = recordedCombo;
  event.preventDefault();
};

// FIXME: HotkeyRecordingDialog内に移動する
const { hotkeyManager } = useHotkeyManager();
const changeHotkeySettings = (
  action: string,
  combination: HotkeyCombination,
) => {
  hotkeyManager.replace({
    action: action as HotkeyActionNameType,
    combination,
  });
  return store.actions.SET_HOTKEY_SETTINGS({
    data: {
      action: action as HotkeyActionNameType,
      combination,
    },
  });
};

const duplicatedHotkey = computed(() => {
  if (lastRecord.value == "") return undefined;
  return hotkeySettings.value.find(
    (item) =>
      item.combination == lastRecord.value && item.action != lastAction.value,
  );
});

// FIXME: actionはHotkeyAction型にすべき
const deleteHotkey = (action: string) => {
  void changeHotkeySettings(action, HotkeyCombination(""));
};

const getHotkeyText = (action: string, combo: string) => {
  if (checkHotkeyReadonly(action)) return "（読み取り専用）" + combo;
  if (combo == "") return "未割り当て";
  return combo;
};

// for later developers, in case anyone wants to add a readonly hotkey
const readonlyHotkeyKeys: string[] = [];

const checkHotkeyReadonly = (action: string) => {
  return readonlyHotkeyKeys.includes(action);
};

const openHotkeyDialog = (action: string) => {
  lastAction.value = action;
  lastRecord.value = HotkeyCombination("");
  isHotkeyDialogOpened.value = true;
  document.addEventListener("keydown", recordCombination);
};

const setHotkeyDialogOpened = () => {
  lastAction.value = "";
  lastRecord.value = HotkeyCombination("");
  isHotkeyDialogOpened.value = false;
  document.removeEventListener("keydown", recordCombination);
};

const isDefaultCombination = (action: string) => {
  const defaultSetting = getDefaultHotkeySettings({ isMac }).find(
    (value) => value.action === action,
  );
  const hotkeySetting = hotkeySettings.value.find(
    (value) => value.action === action,
  );
  return hotkeySetting?.combination === defaultSetting?.combination;
};

const resetHotkey = async (action: string) => {
  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    title: "デフォルトに戻しますか？",
    message: `${action}のショートカットキーをデフォルトに戻します。`,
    actionName: "デフォルトに戻す",
  });

  if (result !== "OK") return;

  const setting = getDefaultHotkeySettings({ isMac }).find(
    (value) => value.action == action,
  );
  if (setting == undefined) {
    return;
  }
  // デフォルトが未設定でない場合は、衝突チェックを行う
  if (setting.combination) {
    const duplicated = hotkeySettings.value.find(
      (item) =>
        item.combination == setting.combination && item.action != action,
    );
    if (duplicated != undefined) {
      openHotkeyDialog(action);
      lastRecord.value = duplicated.combination;
      return;
    }
  }
  void changeHotkeySettings(action, setting.combination);
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/visually-hidden" as visually-hidden;

.search-box {
  width: 200px;
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

.key-button {
  display: flex;
  flex-direction: column;
}

.container {
  position: absolute;
  left: 0;
  right: 0;
  height: 100%;
  background-color: colors.$background;
}

.table {
  display: grid;
  grid-template-columns: 1fr minmax(auto, 480px) auto auto 1fr;
  width: 100%;
}

.table-header {
  position: sticky;
  top: 0;
  z-index: 1;
  border-bottom: 1px solid colors.$border;
  font-weight: 700;
  background-color: colors.$surface;
  height: 32px;
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: span 5;
  align-items: center;
}

.table-row {
  height: 40px;
}

.table-row:nth-child(odd) {
  background-color: colors.$background-alt;
}

.table-cell {
  padding: 0 vars.$padding-1;
}

.table-cell:first-child,
.table-cell:last-child {
  width: 100%;
}

.hotkey-name {
  max-width: 480px;
}

.icon-buttons {
  display: flex;
  gap: vars.$gap-1;
  opacity: 0;
}

:where(:hover, :has(:focus-visible)) > .icon-buttons {
  opacity: 1;
}
</style>
