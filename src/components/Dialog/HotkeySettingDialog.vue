<template>
  <QDialog
    v-model="hotkeySettingDialogOpenComputed"
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
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
            hide-bottom-space
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
          <QTable
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
              <QTr :props="tableProps">
                <QTh
                  v-for="col of tableProps.cols"
                  :key="col.name"
                  :props="tableProps"
                >
                  {{ col.label }}
                </QTh>
              </QTr>
            </template>

            <template #body="tableProps">
              <QTr :props="tableProps">
                <QTd
                  :key="tableProps.cols[0].name"
                  no-hover
                  :props="tableProps"
                >
                  {{ tableProps.row.action }}
                </QTd>
                <QTd
                  :key="tableProps.cols[1].name"
                  no-hover
                  :props="tableProps"
                >
                  <QBtn
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
                    @click="openHotkeyDialog(tableProps.row.action)"
                  />
                  <QBtn
                    rounded
                    flat
                    icon="settings_backup_restore"
                    padding="none sm"
                    size="1em"
                    :disable="checkHotkeyReadonly(tableProps.row.action)"
                    @click="resetHotkey(tableProps.row.action)"
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
        <span v-if="lastRecord !== '' && confirmBtnDisabled"> +</span>
        <span v-if="lastActionArgumentKey !== undefined"> + </span>
        <QChip
          v-if="lastActionArgumentKey !== undefined"
          :ripple="false"
          color="surface"
        >
          {{ getArgumentKeyCombinationText(lastActionArgumentKey) }}
        </QChip>
        <div v-if="duplicatedHotkeys.length > 0" class="text-warning q-mt-lg">
          <div class="text-warning">
            ショートカットキーが次の操作と重複しています
          </div>
          <div class="q-mt-sm text-weight-bold text-warning">
            <template v-for="duplicatedHotkey in duplicatedHotkeys">
              「{{ duplicatedHotkey.action }}」
            </template>
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
          v-if="duplicatedHotkeys.length == 0"
          padding="xs md"
          label="OK"
          unelevated
          color="primary"
          text-color="display-on-primary"
          class="q-mt-sm"
          :disabled="confirmBtnDisabled"
          @click="
            changeHotkeySettings(lastAction, lastRecord).then(() =>
              closeHotkeyDialog()
            )
          "
        />
        <QBtn
          v-else
          padding="xs md"
          label="上書きする"
          unelevated
          color="primary"
          text-color="display-on-primary"
          class="q-mt-sm"
          :disabled="confirmBtnDisabled"
          @click="solveDuplicated().then(() => closeHotkeyDialog())"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/store";
import {
  HotkeyActionNameType,
  HotkeyArgumentKeyType,
  HotkeyCombination,
  HotkeySettingType,
} from "@/type/preload";
import {
  useHotkeyManager,
  eventToCombination,
  getArgumentKey,
  getArgumentKeyCombinationWithSpace,
  getArgumentKeyCombinationText,
} from "@/plugins/hotkeyPlugin";

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

const isHotkeyDialogOpened = ref(false);

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

const lastAction = ref("");
const lastRecord = ref(HotkeyCombination(""));
/** lastActionに役割キーがあれば取得 */
const lastActionArgumentKey = computed<HotkeyArgumentKeyType>(() =>
  lastAction.value == ""
    ? undefined
    : getArgumentKey(lastAction.value as HotkeyActionNameType)
);

const recordCombination = (event: KeyboardEvent) => {
  if (!isHotkeyDialogOpened.value) {
    return;
  } else {
    let recordedCombo = eventToCombination(event);
    // 役割キーがある場合は修飾キーのみにする
    if (lastActionArgumentKey.value != undefined) {
      recordedCombo = HotkeyCombination(
        recordedCombo
          .split(" ")
          .filter((item) => ["Ctrl", "Shift", "Alt", "Meta"].includes(item))
          .join(" ")
      );
    }
    lastRecord.value = recordedCombo;
    event.preventDefault();
  }
};

const { hotkeyManager } = useHotkeyManager();
const changeHotkeySettings = (
  action: string,
  combination: HotkeyCombination
) => {
  hotkeyManager.replace({
    action: action as HotkeyActionNameType,
    combination,
  });
  return store.dispatch("SET_HOTKEY_SETTINGS", {
    data: {
      action: action as HotkeyActionNameType,
      combination,
    },
  });
};

const duplicatedHotkeys = computed(() =>
  filterDuplicatedHotkeysWithSetKeyAndName(
    lastRecord.value,
    lastAction.value as HotkeyActionNameType
  )
);

const filterDuplicatedHotkeysWithSetKeyAndName = (
  key: HotkeyCombination,
  action: HotkeyActionNameType
): HotkeySettingType[] => {
  if (!key) return [];
  // getArgumentKeyWithSpaceはargumentKeyがないときは[ "" ]という長さ1の配列が返ってくるので、一度処理される
  // また存在するときはスペース付きで返ってくるのでただのstringの足し算で良い
  return getArgumentKeyCombinationWithSpace(getArgumentKey(action))
    .map((argumentKey) =>
      findDuplicatedHotkeyWithKey(HotkeyCombination(key + argumentKey), action)
    )
    .filter((result): result is HotkeySettingType => result != undefined);
};

const findDuplicatedHotkeyWithKey = (
  key: HotkeyCombination,
  action: HotkeyActionNameType
): HotkeySettingType | undefined =>
  hotkeySettings.value.find((item) => {
    const findResult = getArgumentKeyCombinationWithSpace(
      getArgumentKey(item.action)
    ).find((argumentKey) => {
      const itemKeyCombination = HotkeyCombination(
        item.combination + argumentKey
      );
      return itemKeyCombination === key && item.action !== action;
    });
    return findResult != undefined;
  });

// FIXME: actionはHotkeyAction型にすべき
const deleteHotkey = (action: string) => {
  changeHotkeySettings(action, HotkeyCombination(""));
};

const getHotkeyText = (action: string, combo: string) => {
  if (checkHotkeyReadonly(action)) combo = "（読み取り専用）" + combo;
  if (combo == "") return "未設定";
  const argumentKey = getArgumentKey(action as HotkeyActionNameType);
  if (argumentKey != undefined) {
    combo += " " + `[${getArgumentKeyCombinationText(argumentKey)}]`;
  }
  return combo;
};

// for later developers, in case anyone wants to add a readonly hotkey
// 読み取り専用モードにする際には、ユーザーがすでに設定したキーを変更しなければならない場合があるため、慎重に
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

const closeHotkeyDialog = () => {
  lastAction.value = "";
  lastRecord.value = HotkeyCombination("");
  isHotkeyDialogOpened.value = false;
  document.removeEventListener("keydown", recordCombination);
};

const solveDuplicated = () => {
  if (duplicatedHotkeys.value.length == 0)
    throw new Error("duplicatedHotkeys.value.length == 0");
  for (const duplicatedHotkey of duplicatedHotkeys.value) {
    deleteHotkey(duplicatedHotkey.action);
  }
  return changeHotkeySettings(lastAction.value, lastRecord.value);
};

const confirmBtnDisabled = computed(() => {
  return (
    lastRecord.value == "" ||
    (lastActionArgumentKey.value == undefined &&
      ["Ctrl", "Shift", "Alt", "Meta"].includes(
        lastRecord.value.split(" ")[lastRecord.value.split(" ").length - 1]
      ))
  );
});

const resetHotkey = async (action: string) => {
  const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
    title: "ショートカットキーを初期値に戻します",
    message: `${action}のショートカットキーを初期値に戻します。<br/>本当に戻しますか？`,
    html: true,
    actionName: "初期値に戻す",
    cancel: "初期値に戻さない",
  });
  if (result === "OK") {
    window.backend
      .getDefaultHotkeySettings()
      .then((defaultSettings: HotkeySettingType[]) => {
        const setting = defaultSettings.find((value) => value.action == action);
        if (setting == undefined) {
          return;
        }
        // デフォルトが未設定でない場合は、衝突チェックを行う
        if (setting.combination) {
          const duplicatedSettings = filterDuplicatedHotkeysWithSetKeyAndName(
            setting.combination,
            action as HotkeyActionNameType
          );
          if (duplicatedSettings.length > 0) {
            openHotkeyDialog(action);
            lastRecord.value = setting.combination;
            return;
          }
        }
        changeHotkeySettings(action, setting.combination);
      });
  }
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
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
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
