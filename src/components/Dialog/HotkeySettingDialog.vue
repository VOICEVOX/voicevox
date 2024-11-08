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
              <div class="list">
                <BaseRowCard
                  v-for="hotkeySetting in hotkeySettings.filter(
                    (hotkeySetting) =>
                      hotkeySetting.action.includes(hotkeyFilter) ||
                      hotkeySetting.combination.includes(hotkeyFilter),
                  )"
                  :key="hotkeySetting.action"
                  :title="hotkeySetting.action"
                >
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
                    @click="openHotkeyDialog(hotkeySetting.action)"
                  />
                  <BaseIconButton
                    icon="settings_backup_restore"
                    label="デフォルトに戻す"
                    :disabled="
                      checkHotkeyReadonly(hotkeySetting.action) ||
                      isDefaultCombination(hotkeySetting.action)
                    "
                    @click="resetHotkey(hotkeySetting.action)"
                  />
                  <BaseIconButton
                    icon="delete_outline"
                    label="未割り当てにする"
                    :disabled="
                      hotkeySetting.combination === '' ||
                      checkHotkeyReadonly(hotkeySetting.action)
                    "
                    @click="confirmAndDeleteHotkey(hotkeySetting.action)"
                  />
                </BaseRowCard>
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
import BaseRowCard from "@/components/Base/BaseRowCard.vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import { useStore } from "@/store";
import {
  HotkeyActionNameType,
  HotkeyCombination,
  HotkeySettingType,
} from "@/type/preload";
import { useHotkeyManager, eventToCombination } from "@/plugins/hotkeyPlugin";

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
  } else {
    const recordedCombo = eventToCombination(event);
    lastRecord.value = recordedCombo;
    event.preventDefault();
  }
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
const confirmAndDeleteHotkey = async (action: string) => {
  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    title: "ショートカットキーを未割り当てにします",
    message: `${action}のショートカットキーを未割り当てにします。\n本当に戻しますか？`,
    actionName: "未割り当てにする",
    cancel: "未割り当てにしない",
  });

  if (result !== "OK") {
    deleteHotkey(action);
  }
};

// FIXME: actionはHotkeyAction型にすべき
const deleteHotkey = (action: string) => {
  void changeHotkeySettings(action, HotkeyCombination(""));
};

const getHotkeyText = (action: string, combo: string) => {
  if (checkHotkeyReadonly(action)) combo = "（読み取り専用）" + combo;
  if (combo == "") return "未設定";
  else return combo;
};

// for later developers, in case anyone wants to add a readonly hotkey
const readonlyHotkeyKeys: string[] = [];

const checkHotkeyReadonly = (action: string) => {
  let flag = false;
  readonlyHotkeyKeys.forEach((key) => {
    if (key == action) {
      flag = true;
    }
  });
  return flag;
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

const defaultSettings = ref<HotkeySettingType[]>([]);
void window.backend
  .getDefaultHotkeySettings()
  .then((settings) => (defaultSettings.value = settings));

const isDefaultCombination = (action: string) => {
  const defaultSetting = defaultSettings.value.find(
    (value) => value.action === action,
  );
  const hotkeySetting = hotkeySettings.value.find(
    (value) => value.action === action,
  );
  return hotkeySetting?.combination === defaultSetting?.combination;
};

const resetHotkey = async (action: string) => {
  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    title: "ショートカットキーを初期値に戻します",
    message: `${action}のショートカットキーを初期値に戻します。\n本当に戻しますか？`,
    actionName: "初期値に戻す",
    cancel: "初期値に戻さない",
  });

  if (result !== "OK") return;

  const setting = defaultSettings.value.find((value) => value.action == action);
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
@use "@/styles/colors" as colors;

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

.container {
  position: absolute;
  left: 0;
  right: 0;
  height: 100%;
  background-color: colors.$background;
}

.list {
  margin: auto;
  max-width: 960px;
  padding: vars.$padding-2;
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
}
</style>
