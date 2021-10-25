<template>
  <q-dialog
    maximized
    seamless
    transition-show="none"
    transition-hide="none"
    class="hotkey-setting-dialog"
    v-model="hotkeySettingDialogOpenComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-white">
      <q-header class="q-py-sm">
        <q-toolbar>
          <q-toolbar-title class="text-secondary"
            >設定 / キー割り当て</q-toolbar-title
          >
          <q-input
            hide-bottom-space
            dense
            placeholder="検索"
            color="secondary"
            class="q-mr-sm search-box"
            v-model="hotkeyFilter"
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
            color="secondary"
            @click="hotkeySettingDialogOpenComputed = false"
          />
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page>
          <q-table
            flat
            dense
            hide-bottom
            row-key="hotkeyIndexes"
            :filter="hotkeyFilter"
            :rows="hotkeyRows"
            :columns="hotkeyColumns"
            class="hotkey-table"
            v-model:pagination="hotkeyPagination"
          >
            <template #header="props">
              <q-tr :props="props">
                <q-th v-for="col of props.cols" :key="col.name" :props="props">
                  {{ col.label }}
                </q-th>
              </q-tr>
            </template>

            <template #body="props">
              <q-tr :props="props">
                <q-td no-hover :key="props.cols[0].name" :props="props">
                  {{ props.row.action }}
                </q-td>
                <q-td no-hover :key="props.cols[1].name" :props="props">
                  <q-btn
                    dense
                    color="secondary"
                    padding="none sm"
                    flat
                    :disable="checkHotkeyReadonly(props.row.action)"
                    no-caps
                    :label="
                      getHotkeyText(props.row.action, props.row.combination)
                        .split(' ')
                        .join(' + ')
                    "
                    @click="
                      openHotkeyDialog(props.row.action, props.row.combination)
                    "
                  />
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
    transition-show="none"
    transition-hide="none"
    :model-value="isHotkeyDialogOpened"
    @update:model-value="closeHotkeyDialog"
  >
    <q-card class="q-py-sm q-px-md">
      <q-card-section align="center">
        <div class="text-h6">
          任意のキーの組み合わせを押し、確定ボタンを押します
        </div>
      </q-card-section>
      <q-card-section align="center">
        <template v-for="(hotkey, index) in lastRecord.split(' ')" :key="index">
          <span v-if="index !== 0"> + </span>
          <q-chip :ripple="false">
            {{ hotkey }}
          </q-chip>
        </template>
        <span v-if="lastRecord !== '' && confirmBtnEnabled"> +</span>
      </q-card-section>
      <q-card-actions align="center">
        <q-btn
          padding="xs md"
          label="このショートカットキーを削除"
          unelevated
          color="grey-3"
          text-color="black"
          class="q-mt-sm"
          @click="
            deleteHotkey(lastAction);
            closeHotkeyDialog();
          "
          :disabled="lastRecord === ''"
        />
        <q-btn
          padding="xs md"
          label="確定"
          unelevated
          color="primary"
          text-color="black"
          class="q-mt-sm"
          @click="
            changeHotkeySettings(lastAction, lastRecord, true)?.then(() => {
              closeHotkeyDialog();
            })
          "
          :disabled="confirmBtnEnabled"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <q-dialog
    transition-show="none"
    transition-hide="none"
    :model-value="isHotkeyDuplicatedDialogOpened"
    @update:model-value="closeHotkeyDuplicatedDialog(false)"
  >
    <q-card class="q-py-sm q-px-md">
      <q-card-section>
        <div class="text-h6">ショートカットキーが重複しています</div>
      </q-card-section>
      <q-card-section align="center" class="q-pa-none">
        <template v-for="(hotkey, index) in lastRecord.split(' ')" :key="index">
          <span v-if="index !== 0"> + </span>
          <q-chip :ripple="false">
            {{ hotkey }}
          </q-chip>
        </template>
      </q-card-section>
      <q-card-section class="q-pb-none"
        >割り当てる操作を選択してください</q-card-section
      >
      <q-card-actions align="center">
        <q-btn
          padding="xs md"
          square
          unelevated
          color="grey-3"
          text-color="black"
          :label="lastAction"
          class="q-mt-sm"
          @click="solveDuplicated(true)"
        />
        <q-btn
          padding="xs md"
          square
          unelevated
          color="grey-3"
          text-color="black"
          :label="lastDuplicated.action"
          class="q-mt-sm"
          @click="closeHotkeyDuplicatedDialog(true)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from "vue";
import { useStore } from "@/store";
import { parseCombo } from "@/store/setting";
import { HotkeyAction, HotkeySetting } from "@/type/preload";

export default defineComponent({
  name: "HotkeySettingDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();

    const hotkeySettingDialogOpenComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const isHotkeyDialogOpened = ref(false);
    const isHotkeyDuplicatedDialogOpened = ref(false);

    const hotkeyPagination = ref({ rowsPerPage: 0 });
    const hotkeyFilter = ref("");

    const hotkeyRows = computed(() => store.state.hotkeySettings);

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
    const lastDuplicated = ref<HotkeySetting | undefined>(undefined);

    const recordCombination = (event: KeyboardEvent) => {
      if (!isHotkeyDialogOpened.value || isHotkeyDuplicatedDialogOpened.value) {
        return;
      } else {
        let recordedCombo = parseCombo(event);
        lastRecord.value = recordedCombo;
        event.preventDefault();
      }
    };

    const changeHotkeySettings = (
      action: string,
      combo: string,
      checkDuplicated: boolean
    ) => {
      if (checkDuplicated) {
        const duplicated = findDuplicatedHotkey();
        if (duplicated !== undefined) {
          lastDuplicated.value = duplicated;
          isHotkeyDuplicatedDialogOpened.value = true;
          return;
        }
      }
      return store.dispatch("SET_HOTKEY_SETTINGS", {
        data: {
          action: action as HotkeyAction,
          combination: combo,
        },
      });
    };

    const findDuplicatedHotkey = () => {
      return store.state.hotkeySettings.find((item) => {
        return (
          item.combination == lastRecord.value &&
          item.action != lastAction.value
        );
      });
    };

    const deleteHotkey = (action: HotkeyAction) => {
      changeHotkeySettings(action, "", false);
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

    const openHotkeyDialog = (action: string, combo: string) => {
      lastAction.value = action;
      lastRecord.value = combo;
      isHotkeyDialogOpened.value = true;
      document.addEventListener("keydown", recordCombination);
    };

    const closeHotkeyDialog = () => {
      lastAction.value = "";
      lastRecord.value = "";
      isHotkeyDialogOpened.value = false;
      document.removeEventListener("keydown", recordCombination);
    };

    const closeHotkeyDuplicatedDialog = (closeParent: boolean) => {
      lastDuplicated.value = undefined;
      isHotkeyDuplicatedDialogOpened.value = false;
      if (closeParent) {
        closeHotkeyDialog();
      }
    };

    const solveDuplicated = () => {
      if (lastDuplicated.value == undefined)
        throw new Error("lastDuplicated.value == undefined");
      deleteHotkey(lastDuplicated.value.action);
      changeHotkeySettings(lastAction.value, lastRecord.value, false)?.then(
        () => {
          closeHotkeyDuplicatedDialog(true);
        }
      );
    };

    const confirmBtnEnabled = computed(() => {
      return (
        lastRecord.value == "" ||
        ["Ctrl", "Shift", "Alt"].indexOf(
          lastRecord.value.split(" ")[lastRecord.value.split(" ").length - 1]
        ) > -1
      );
    });

    return {
      hotkeySettingDialogOpenComputed,
      isHotkeyDialogOpened,
      isHotkeyDuplicatedDialogOpened,
      hotkeyRows,
      hotkeyColumns,
      hotkeyPagination,
      hotkeyFilter,
      deleteHotkey,
      getHotkeyText,
      openHotkeyDialog,
      closeHotkeyDialog,
      closeHotkeyDuplicatedDialog,
      lastAction,
      lastRecord,
      lastDuplicated,
      solveDuplicated,
      changeHotkeySettings,
      confirmBtnEnabled,
      checkHotkeyReadonly,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;
@import "~quasar/src/css/variables";

.search-box {
  width: 200px;
}

.hotkey-table {
  width: calc(100vw - #{global.$window-border-width * 2});
  height: calc(
    100vh - #{global.$menubar-height + global.$header-height +
      global.$window-border-width}
  );

  > :deep(.scroll) {
    overflow-y: scroll;
    overflow-x: hidden;
  }

  thead tr th {
    position: sticky;
    top: 0;
    font-weight: bold;
    background-color: $grey-3;
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
