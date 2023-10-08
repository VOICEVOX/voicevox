<template>
  <q-dialog
    v-model="hotkeySettingDialogOpenComputed"
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="hotkey-setting-dialog transparent-backdrop"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <q-toolbar-title class="text-display"
            >設定 / キー割り当て</q-toolbar-title
          >
          <q-input
            v-model="hotkeyFilter"
            hide-bottom-space
            dense
            placeholder="検索"
            color="display"
            class="q-mr-sm search-box"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
            <template #append>
              <q-icon
                v-if="hotkeyFilter !== ''"
                name="close"
                class="cursor-pointer"
                @click="hotkeyFilter = ''"
              />
              <q-icon v-else />
            </template>
          </q-input>
          <q-btn
            round
            flat
            icon="close"
            color="display"
            @click="hotkeySettingDialogOpenComputed = false"
          />
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page>
          <q-table
            v-model:pagination="hotkeyPagination"
            flat
            dense
            hide-bottom
            card-class="bg-background text-display"
            table-class="text-display"
            row-key="hotkeyIndexes"
            :filter="hotkeyFilter"
            :rows="hotkeySettings"
            :columns="hotkeyColumns"
            class="hotkey-table"
          >
            <template #header="tableProps">
              <q-tr :props="tableProps">
                <q-th
                  v-for="col of tableProps.cols"
                  :key="col.name"
                  :props="tableProps"
                >
                  {{ col.label }}
                </q-th>
              </q-tr>
            </template>

            <template #body="tableProps">
              <q-tr
                :props="tableProps"
                @click="openHotkeyDialog(tableProps.row.action)"
              >
                <q-td
                  :key="tableProps.cols[0].name"
                  no-hover
                  :props="tableProps"
                >
                  {{ tableProps.row.action }}
                </q-td>
                <q-td
                  :key="tableProps.cols[1].name"
                  no-hover
                  :props="tableProps"
                >
                  <q-btn
                    dense
                    text-color="display"
                    padding="none sm"
                    flat
                    :disable="checkHotkeyReadonly(tableProps.row.action)"
                    no-caps
                    :label="
                      getHotkeyText(
                        tableProps.row.action,
                        tableProps.row.combination
                      )
                        .split(' ')
                        .map((hotkeyText) => {
                          // Mac の Meta キーは Cmd キーであるため、Meta の表示名を Cmd に置換する
                          // Windows PC では Meta キーは Windows キーだが、使用頻度低と考えられるため暫定的に Mac 対応のみを考慮している
                          return hotkeyText === 'Meta' ? 'Cmd' : hotkeyText;
                        })
                        .join(' + ')
                    "
                  />
                  <div class="buttons">
                    <q-btn
                      rounded
                      flat
                      icon="settings_backup_restore"
                      padding="none sm"
                      size="1em"
                      :disable="checkHotkeyReadonly(tableProps.row.action)"
                      @click.stop="
                        resetHotkeyWithConfirm(tableProps.row.action)
                      "
                    >
                      <q-tooltip :delay="500">デフォルトに戻す</q-tooltip>
                    </q-btn>
                    <q-btn
                      rounded
                      flat
                      icon="delete"
                      padding="none sm"
                      size="1em"
                      :disable="checkHotkeyReadonly(tableProps.row.action)"
                      @click.stop="
                        deleteHotkeyWithConfirm(tableProps.row.action)
                      "
                    >
                      <q-tooltip :delay="500">未割り当てにする</q-tooltip>
                    </q-btn>
                  </div>
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>

  <q-dialog
    no-esc-dismiss
    no-shake
    transition-show="none"
    transition-hide="none"
    :model-value="isHotkeyDialogOpened"
    @update:model-value="closeHotkeyDialog"
  >
    <q-card class="q-py-sm q-px-md">
      <q-card-section>
        <div class="text-h6">「{{ targetAction }}」</div>
      </q-card-section>
      <q-card-section>
        <template
          v-for="(hotkey, index) in targetRecord.split(' ')"
          :key="index"
        >
          <span v-if="index !== 0"> + </span>
          <!--
          Mac の Meta キーは Cmd キーであるため、Meta の表示名を Cmd に置換する
          Windows PC では Meta キーは Windows キーだが、使用頻度低と考えられるため暫定的に Mac 対応のみを考慮している
          -->
          <q-chip :ripple="false" color="surface">
            {{
              hotkey === "Meta"
                ? "Cmd"
                : hotkey === ""
                ? EMPTY_COMBO_NAME
                : hotkey
            }}
          </q-chip>
        </template>
        <span v-if="isOnlyModifierKey"> +</span>
        <div v-if="duplicatedHotkey != undefined" class="text-warning q-mt-lg">
          <div class="text-warning">
            ショートカットキーが次の操作と重複しています：
          </div>
          <div class="q-mt-sm text-weight-bold text-warning">
            「{{ duplicatedHotkey.action }}」
          </div>
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn
          padding="xs md"
          label="キャンセル"
          unelevated
          color="surface"
          text-color="display"
          class="q-mt-sm"
          @click="closeHotkeyDialog"
        />
        <q-btn
          v-if="duplicatedHotkey == undefined"
          padding="xs md"
          label="OK"
          unelevated
          color="primary"
          text-color="display-on-primary"
          class="q-mt-sm"
          :disabled="confirmBtnDisabled"
          @click="
            changeHotkeySettings(targetAction, targetRecord).then(
              closeHotkeyDialog
            )
          "
        />
        <q-btn
          v-else
          padding="xs md"
          label="上書きする"
          unelevated
          color="primary"
          text-color="display-on-primary"
          class="q-mt-sm"
          :disabled="confirmBtnDisabled"
          @click="solveDuplicated().then(closeHotkeyDialog)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/store";
import { parseCombo } from "@/store/setting";
import { HotkeySetting } from "@/type/preload";

const props =
  defineProps<{
    modelValue: boolean;
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", val: boolean): void;
  }>();

const store = useStore();

const hotkeySettingDialogOpenComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const hotkeyPagination = ref({ rowsPerPage: 0 });
const hotkeyFilter = ref("");

const hotkeySettings = computed(() => store.state.hotkeySettings);

// FIXME: satisfiesを使うなどで型を表現したい
const hotkeyColumns = ref<
  {
    name: string;
    align: "left" | "right" | "center" | undefined;
    label: string;
    field: string;
  }[]
>([
  {
    name: "action",
    align: "left",
    label: "操作",
    field: "action",
  },
  {
    name: "combination",
    align: "left",
    label: "ショートカットキー",
    field: "combination",
  },
]);

// FIXME: actionはHotkeyAction型にすべき
const changeHotkeySettings = (action: string, combination: string) => {
  // FIXME: しないよりはマシなので存在チェック
  const _action = findHotkeySetting(hotkeySettings.value, action).action;

  return store.dispatch("SET_HOTKEY_SETTINGS", {
    data: {
      action: _action,
      combination,
    },
  });
};

const EMPTY_COMBO_NAME = "(未割り当て)";
const getHotkeyText = (action: string, combo: string) => {
  if (checkHotkeyReadonly(action)) {
    combo = "(読み取り専用) " + combo;
  }
  return combo == "" ? EMPTY_COMBO_NAME : combo;
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

const findHotkeySetting = (hotkeySettings: HotkeySetting[], action: string) => {
  const hotkeySetting = hotkeySettings.find(
    (hotkeySetting) => hotkeySetting.action === action
  );
  if (hotkeySetting === undefined)
    throw new Error(`「${action}」は存在しないHotkey Actionです。`);
  return hotkeySetting;
};
const getCurrentHotkeyCombination = (action: string) =>
  findHotkeySetting(hotkeySettings.value, action).combination;
const getDefaultHotkeyCombination = async (action: string) =>
  findHotkeySetting(await window.electron.getDefaultHotkeySettings(), action)
    .combination;

const getDuplicatedHotkey = (action: string, combination: string) =>
  hotkeySettings.value.find(
    (item) => item.combination === combination && item.action !== action
  );

const resetHotkeyWithConfirm = async (action: string) => {
  const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
    title: "ショートカットキーの初期化",
    message: `「${action}」のショートカットキーを初期値に戻します。<br>本当に戻しますか？`,
    html: true,
    actionName: "初期値に戻す",
  });
  if (result === "OK") {
    const combination = await getDefaultHotkeyCombination(action);
    changeHotkeySettings(action, combination);
  }
};

const deleteHotkeyWithConfirm = async (action: string) => {
  const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
    title: "ショートカットキーの割り当ての解除",
    message: `「${action}」のショートカットキーを未割り当てにします。<br>本当に解除しますか？`,
    html: true,
    actionName: "解除する",
  });
  if (result === "OK") {
    changeHotkeySettings(action, "");
  }
};

// 個別設定ダイアログ
const isHotkeyDialogOpened = ref(false);
const targetAction = ref("");
const targetRecord = ref("");

const duplicatedHotkey = computed(() =>
  targetRecord.value == ""
    ? undefined
    : getDuplicatedHotkey(targetAction.value, targetRecord.value)
);

const isOnlyModifierKey = computed(() =>
  ["Ctrl", "Shift", "Alt", "Meta"].includes(
    targetRecord.value.split(" ")[targetRecord.value.split(" ").length - 1]
  )
);
const confirmBtnDisabled = computed(() => {
  const isChangedRecord =
    getCurrentHotkeyCombination(targetAction.value) !== targetRecord.value;
  return !isChangedRecord || isOnlyModifierKey.value;
});

const recordCombination = (event: KeyboardEvent) => {
  if (!isHotkeyDialogOpened.value) {
    return;
  } else {
    const recordedCombo = parseCombo(event);
    targetRecord.value = recordedCombo;
    event.preventDefault();
  }
};

const openHotkeyDialog = (action: string) => {
  targetAction.value = action;
  targetRecord.value = getCurrentHotkeyCombination(action);
  isHotkeyDialogOpened.value = true;
  document.addEventListener("keydown", recordCombination);
};

const closeHotkeyDialog = () => {
  targetAction.value = "";
  targetRecord.value = "";
  isHotkeyDialogOpened.value = false;
  document.removeEventListener("keydown", recordCombination);
};

const solveDuplicated = async () => {
  if (duplicatedHotkey.value == undefined)
    throw new Error("duplicatedHotkey.value == undefined");
  await changeHotkeySettings(duplicatedHotkey.value.action, "");
  await changeHotkeySettings(targetAction.value, targetRecord.value);
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.search-box {
  width: 200px;
}

.hotkey-table {
  width: calc(100vw - #{vars.$window-border-width * 2});
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width}
  );

  > :deep(.scroll) {
    overflow-y: scroll;
    overflow-x: hidden;

    > .q-table {
      max-width: 50rem;
    }
  }

  tbody tr {
    cursor: pointer;

    &:hover td::before {
      content: "";
    }
    td .buttons {
      float: right;
      display: none;
    }
    &:hover td .buttons {
      display: inline-flex;
      color: colors.$display;
      opacity: 0.5;
      &:hover {
        opacity: 1;
      }
    }
  }

  thead tr th {
    position: sticky;
    top: 0;
    font-weight: bold;
    background-color: colors.$surface;
    z-index: 1;
  }

  thead tr th:first-child,
  tbody tr td:first-child {
    width: 70%;
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  thead tr th:last-child,
  tbody tr td:last-child {
    max-width: 0;
    min-width: 180px;
  }
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}
</style>
