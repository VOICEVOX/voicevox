<template>
  <QDialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="hotkey-setting-dialog transparent-backdrop"
    v-model="hotkeySettingDialogOpenComputed"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <QToolbarTitle class="text-display"
            >設定 / キー割り当て</QToolbarTitle
          >
          <QInput
            hide-bottom-space
            dense
            placeholder="検索"
            color="display"
            class="q-mr-sm search-box"
            v-model="hotkeyFilter"
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
          <QTable
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
            v-model:pagination="hotkeyPagination"
          >
            <template #header="props">
              <QTr :props="props">
                <QTh v-for="col of props.cols" :key="col.name" :props="props">
                  {{ col.label }}
                </QTh>
              </QTr>
            </template>

            <template #body="props">
              <QTr :props="props">
                <QTd no-hover :key="props.cols[0].name" :props="props">
                  {{ props.row.action }}
                </QTd>
                <QTd no-hover :key="props.cols[1].name" :props="props">
                  <QBtn
                    dense
                    text-color="display"
                    padding="none sm"
                    flat
                    :disable="checkHotkeyReadonly(props.row.action)"
                    no-caps
                    :label="
                      getHotkeyText(props.row.action, props.row.combination)
                        .split(' ')
                        .map((hotkeyText) => {
                          // Mac の Meta キーは Cmd キーであるため、Meta の表示名を Cmd に置換する
                          // Windows PC では Meta キーは Windows キーだが、使用頻度低と考えられるため暫定的に Mac 対応のみを考慮している
                          return hotkeyText === 'Meta' ? 'Cmd' : hotkeyText;
                        })
                        .join(' + ')
                    "
                    @click="openHotkeyDialog(props.row.action)"
                  />
                  <QBtn
                    rounded
                    flat
                    icon="settings_backup_restore"
                    padding="none sm"
                    size="1em"
                    :disable="checkHotkeyReadonly(props.row.action)"
                    @click="resetHotkey(props.row.action)"
                  >
                    <QTooltip :delay="500">デフォルトに戻す</QTooltip>
                  </QBtn>
                </QTd>
              </QTr>
            </template>
          </QTable>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>

  <QDialog
    no-esc-dismiss
    no-shake
    transition-show="none"
    transition-hide="none"
    :model-value="isHotkeyDialogOpened"
    @update:model-value="closeHotkeyDialog"
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
          text-color="display"
          class="q-mt-sm"
          @click="closeHotkeyDialog"
        />
        <QBtn
          padding="xs md"
          label="ショートカットキーを未設定にする"
          unelevated
          color="surface"
          text-color="display"
          class="q-mt-sm"
          @click="
            deleteHotkey(lastAction);
            closeHotkeyDialog();
          "
        />
        <QBtn
          v-if="duplicatedHotkey == undefined"
          padding="xs md"
          label="OK"
          unelevated
          color="primary"
          text-color="display-on-primary"
          class="q-mt-sm"
          @click="
            changeHotkeySettings(lastAction, lastRecord).then(() =>
              closeHotkeyDialog()
            )
          "
          :disabled="confirmBtnEnabled"
        />
        <QBtn
          v-else
          padding="xs md"
          label="上書きする"
          unelevated
          color="primary"
          text-color="display-on-primary"
          class="q-mt-sm"
          @click="solveDuplicated().then(() => closeHotkeyDialog())"
          :disabled="confirmBtnEnabled"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/store";
import { parseCombo } from "@/store/setting";
import { HotkeyAction, HotkeySetting } from "@/type/preload";
import { useQuasar } from "quasar";

const props =
  defineProps<{
    modelValue: boolean;
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", val: boolean): void;
  }>();

const store = useStore();
const $q = useQuasar();

const hotkeySettingDialogOpenComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const isHotkeyDialogOpened = ref(false);

const hotkeyPagination = ref({ rowsPerPage: 0 });
const hotkeyFilter = ref("");

const hotkeySettings = computed(() => store.state.hotkeySettings);

const hotkeyColumns = ref([
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

const lastAction = ref("");
const lastRecord = ref("");

const recordCombination = (event: KeyboardEvent) => {
  if (!isHotkeyDialogOpened.value) {
    return;
  } else {
    const recordedCombo = parseCombo(event);
    lastRecord.value = recordedCombo;
    event.preventDefault();
  }
};

const changeHotkeySettings = (action: string, combo: string) => {
  return store.dispatch("SET_HOTKEY_SETTINGS", {
    data: {
      action: action as HotkeyAction,
      combination: combo,
    },
  });
};

const duplicatedHotkey = computed(() => {
  if (lastRecord.value == "") return undefined;
  return hotkeySettings.value.find(
    (item) =>
      item.combination == lastRecord.value && item.action != lastAction.value
  );
});

const deleteHotkey = (action: HotkeyAction) => {
  changeHotkeySettings(action, "");
};

const getHotkeyText = (action: string, combo: string) => {
  if (checkHotkeyReadonly(action)) combo = "(読み取り専用) " + combo;
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
  lastRecord.value = "";
  isHotkeyDialogOpened.value = true;
  document.addEventListener("keydown", recordCombination);
};

const closeHotkeyDialog = () => {
  lastAction.value = "";
  lastRecord.value = "";
  isHotkeyDialogOpened.value = false;
  document.removeEventListener("keydown", recordCombination);
};

const solveDuplicated = () => {
  if (duplicatedHotkey.value == undefined)
    throw new Error("duplicatedHotkey.value == undefined");
  deleteHotkey(duplicatedHotkey.value.action);
  return changeHotkeySettings(lastAction.value, lastRecord.value);
};

const confirmBtnEnabled = computed(() => {
  return (
    lastRecord.value == "" ||
    ["Ctrl", "Shift", "Alt", "Meta"].indexOf(
      lastRecord.value.split(" ")[lastRecord.value.split(" ").length - 1]
    ) > -1
  );
});

const resetHotkey = (action: string) => {
  $q.dialog({
    title: "ショートカットキーを初期値に戻します",
    message: `${action}のショートカットキーを初期値に戻します。<br/>本当に戻しますか？`,
    html: true,
    ok: {
      label: "初期値に戻す",
      flat: true,
      textColor: "secondary",
    },
    cancel: {
      label: "初期値に戻さない",
      flat: true,
      textColor: "secondary",
    },
  }).onOk(() => {
    window.electron
      .getDefaultHotkeySettings()
      .then((defaultSettings: HotkeySetting[]) => {
        const setting = defaultSettings.find((value) => value.action == action);
        if (setting) {
          changeHotkeySettings(action, setting.combination);
        }
      });
  });
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
  }

  tbody tr {
    td button:last-child {
      float: right;
      display: none;
    }
    &:hover td button:last-child {
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
