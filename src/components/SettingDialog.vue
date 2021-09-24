<template>
  <q-dialog
    maximized
    seamless
    transition-show="none"
    transition-hide="none"
    class="setting-dialog"
    v-model="settingDialogOpenedComputed"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-white">
      <q-header class="q-pa-sm">
        <q-toolbar>
          <q-toolbar-title class="text-secondary">設定</q-toolbar-title>
          <q-space />
          <!-- close button -->
          <q-btn
            round
            flat
            icon="close"
            @click="settingDialogOpenedComputed = false"
          />
        </q-toolbar>
      </q-header>
      <q-page-container>
        <q-page ref="scroller" class="relative-absolute-wrapper scroller">
          <div class="q-pa-md row items-start q-gutter-md">
            <!-- Engine Mode Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">エンジン</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-grey-3">
                <div>エンジンモード</div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  v-model="engineMode"
                  color="white"
                  text-color="black"
                  toggle-color="primary"
                  :options="[
                    { label: 'CPU', value: 'switchCPU' },
                    { label: 'GPU', value: 'switchGPU' },
                  ]"
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    GPUモードの利用には NVIDIA&trade; GPU が必要です
                  </q-tooltip>
                </q-btn-toggle>
              </q-card-actions>
            </q-card>

            <!-- Saving Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">保存</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-grey-3">
                <div>文字コード</div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  :model-value="savingSetting.fileEncoding"
                  @update:model-value="
                    handleSavingSettingChange('fileEncoding', $event)
                  "
                  color="white"
                  text-color="black"
                  toggle-color="primary"
                  :options="[
                    { label: 'UTF-8', value: 'UTF-8' },
                    { label: 'Shift_JIS', value: 'Shift_JIS' },
                  ]"
                />
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-grey-3">
                <div>書き出し先を固定</div>
                <q-space />
                <q-input
                  dense
                  v-if="savingSetting.fixedExportEnabled"
                  maxheight="10px"
                  label="書き出し先のフォルダ"
                  hide-bottom-space
                  readonly
                  :model-value="savingSetting.fixedExportDir"
                  :input-style="{
                    width: `${savingSetting.fixedExportDir.length / 2 + 1}em`,
                    minWidth: '150px',
                    maxWidth: '450px',
                  }"
                  @update:model-value="
                    handleSavingSettingChange('fixedExportDir', $event)
                  "
                >
                  <template v-slot:append>
                    <q-btn
                      square
                      dense
                      flat
                      color="primary"
                      icon="folder_open"
                      @click="openFileExplore"
                    >
                      <q-tooltip :delay="500" anchor="bottom left">
                        フォルダ選択
                      </q-tooltip>
                    </q-btn>
                  </template>
                </q-input>
                <q-toggle
                  name="enabled"
                  align="left"
                  :model-value="savingSetting.fixedExportEnabled"
                  @update:model-value="
                    handleSavingSettingChange('fixedExportEnabled', $event)
                  "
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                    v-if="!savingSetting.fixedExportEnabled"
                  >
                    音声ファイルを設定したフォルダに書き出す
                  </q-tooltip>
                </q-toggle>
              </q-card-actions>
              <!-- avoid overwrite action -->
              <q-card-actions class="q-px-md q-py-none bg-grey-3">
                <div>上書き防止</div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.avoidOverwrite"
                  @update:model-value="
                    handleSavingSettingChange('avoidOverwrite', $event)
                  "
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    上書きせずにファイルを連番で保存します
                  </q-tooltip>
                </q-toggle>
              </q-card-actions>
            </q-card>
            <!-- hotkey settings card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">ショートカットキー</div>
                <q-space />
                <q-input
                  hide-bottom-space
                  dense
                  v-model="hotkeyFilter"
                  placeholder="検索"
                >
                  <template v-slot:append>
                    <q-icon
                      v-if="hotkeyFilter !== ''"
                      name="close"
                      @click="hotkeyFilter = ''"
                      class="cursor-pointer"
                    />
                    <q-icon name="search" />
                  </template>
                </q-input>
              </q-card-actions>
              <q-card-actions class="bg-grey-3">
                <q-table
                  flat
                  dense
                  hide-bottom
                  :filter="hotkeyFilter"
                  :rows="hotkeyRows"
                  :columns="hotkeyColumns"
                  row-key="hotkeyIndexes"
                  v-model:pagination="hotkeyPagination"
                  class="setting-card bg-grey-3"
                >
                  <template v-slot:body="props">
                    <q-tr :props="props">
                      <q-td key="action" :props="props" no-hover>
                        {{ props.row.action }}
                      </q-td>
                      <q-td
                        no-hover
                        key="combination"
                        :class="
                          getHotkeyColor(
                            props.row.action,
                            props.row.combination
                          )
                        "
                        :props="props"
                        @click="
                          toggleShowRecorded(
                            $event,
                            props.row.action,
                            props.row.combination
                          )
                        "
                        @dblclick="deleteHotkey(props.row.action)"
                      >
                        {{
                          getHotkeyText(props.row.action, props.row.combination)
                        }}
                      </q-td>
                    </q-tr>
                  </template>
                </q-table>
              </q-card-actions>
            </q-card>
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from "vue";
import { useStore } from "@/store";
import { ASYNC_UI_LOCK, SET_USE_GPU } from "@/store/ui";
import { RESTART_ENGINE } from "@/store/audio";
import { useQuasar } from "quasar";
import {
  SET_HOTKEY_SETTINGS,
  SET_SAVING_SETTING,
  parseCombo,
} from "@/store/setting";

export default defineComponent({
  name: "SettingDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();
    const $q = useQuasar();

    const settingDialogOpenedComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const engineMode = computed({
      get: () => (store.state.useGpu ? "switchGPU" : "switchCPU"),
      set: (mode: string) => {
        changeUseGPU(mode == "switchGPU" ? true : false);
      },
    });

    const changeUseGPU = async (useGpu: boolean) => {
      if (store.state.useGpu === useGpu) return;

      const change = async () => {
        await store.dispatch(SET_USE_GPU, { useGpu });
        store.dispatch(RESTART_ENGINE);

        $q.dialog({
          title: "エンジンの起動モードを変更しました",
          message: "変更を適用するためにエンジンを再起動します。",
          ok: {
            flat: true,
            textColor: "secondary",
          },
        });
      };

      const isAvailableGPUMode = await new Promise<boolean>((resolve) => {
        store.dispatch(ASYNC_UI_LOCK, {
          callback: async () => {
            $q.loading.show({
              spinnerColor: "primary",
              spinnerSize: 50,
              boxClass: "bg-white text-secondary",
              message: "起動モードを変更中です",
            });
            resolve(await window.electron.isAvailableGPUMode());
            $q.loading.hide();
          },
        });
      });

      if (useGpu && !isAvailableGPUMode) {
        $q.dialog({
          title: "対応するGPUデバイスが見つかりません",
          message:
            "GPUモードの利用には、メモリが3GB以上あるNVIDIA製GPUが必要です。<br />" +
            "このままGPUモードに変更するとエンジンエラーが発生する可能性があります。本当に変更しますか？",
          html: true,
          persistent: true,
          focus: "cancel",
          style: {
            width: "90vw",
            maxWidth: "90vw",
          },
          ok: {
            label: "変更する",
            flat: true,
            textColor: "secondary",
          },
          cancel: {
            label: "変更しない",
            flat: true,
            textColor: "secondary",
          },
        }).onOk(change);
      } else change();
    };

    const restartEngineProcess = () => {
      store.dispatch(RESTART_ENGINE);
    };

    const savingSetting = computed(() => store.state.savingSetting);

    const handleSavingSettingChange = (key: string, data: string | boolean) => {
      store.dispatch(SET_SAVING_SETTING, {
        data: { ...savingSetting.value, [key]: data },
      });
    };

    const openFileExplore = async () => {
      const path = await window.electron.showOpenDirectoryDialog({
        title: "書き出し先のフォルダを選択",
      });
      if (path) {
        store.dispatch(SET_SAVING_SETTING, {
          data: { ...savingSetting.value, fixedExportDir: path },
        });
      }
    };

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
        align: "right",
        label: "ショートカットキー",
        field: "combination",
      },
    ]);

    let lastAction = ref<string | null>(null);
    let lastRecord = ref("");

    const toggleShowRecorded = (
      event: MouseEvent,
      action: string,
      combo: string
    ) => {
      if (event.target instanceof HTMLElement) {
        if (checkHotkeyReadonly(action)) return;
        if (lastAction.value === null) {
          lastRecord.value = combo;
          lastAction.value = action;
        } else if (lastAction.value != action) {
          return;
        } else {
          // verify if there's a duplicated combo
          let duplicated: string | null = null;
          hotkeyRows.value.forEach((value) => {
            if (
              value.combination == lastRecord.value &&
              value.action != action &&
              value.combination != ""
            ) {
              duplicated = value.action;
            }
          });
          if (duplicated !== null) {
            $q.dialog({
              title: "重複のショートカット",
              message:
                "設置するショートカットキー <b>" +
                action +
                ": " +
                lastRecord.value +
                "</b> は <b>" +
                duplicated +
                "</b> と同じです、そっちのを削除しますか？",
              html: true,
              persistent: true,
              focus: "none",
              style: {
                width: "90vw",
                maxWidth: "90vw",
              },
              ok: {
                label: "削除する",
                flat: true,
                textColor: "secondary",
              },
              cancel: {
                label: "キャンセル",
                flat: true,
                textColor: "secondary",
              },
            }).onOk(() => {
              changeHotkeySettings(duplicated!, "");
              changeHotkeySettings(action, lastRecord.value).then(() => {
                lastAction.value = null;
              });
            });
          } else {
            changeHotkeySettings(action, lastRecord.value).then(() => {
              lastAction.value = null;
            });
          }
          event.target.style.color = "";
        }
      }
    };

    const recordCombination = (event: KeyboardEvent) => {
      if (lastAction.value === null) {
        return;
      } else {
        let recordedCombo = parseCombo(event);
        lastRecord.value = recordedCombo;
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", recordCombination);

    const changeHotkeySettings = (action: string, combo: string) => {
      return store.dispatch(SET_HOTKEY_SETTINGS, {
        data: {
          action: action,
          combination: combo,
        },
      });
    };

    const deleteHotkey = (action: string) => {
      changeHotkeySettings(action, "");
    };

    const getHotkeyColor = (action: string, combo: string) => {
      if (action == lastAction.value) {
        if (combo == lastRecord.value) return "text-grey";
        else return "text-primary";
      } else {
        return "text-black";
      }
    };

    const getHotkeyText = (action: string, combo: string) => {
      if (checkHotkeyReadonly(action)) combo = "(読み取り専用) " + combo;
      if (action == lastAction.value) {
        combo = lastRecord.value;
      }
      if (combo == "") return "未設定";
      else return combo;
    };

    // for later developers, in case anyone wants to add a readonly hotkey
    const readonlyHotkeyIndexes: number[] = [];

    const checkHotkeyReadonly = (action: string) => {
      let flag = false;
      readonlyHotkeyIndexes.forEach((index) => {
        if (hotkeyRows.value[index].action == action) {
          flag = true;
        }
      });
      return flag;
    };

    return {
      settingDialogOpenedComputed,
      engineMode,
      restartEngineProcess,
      savingSetting,
      handleSavingSettingChange,
      openFileExplore,
      hotkeyRows,
      hotkeyColumns,
      hotkeyPagination: ref({
        rowsPerPage: 0,
      }),
      hotkeyFilter: ref(""),
      toggleShowRecorded,
      deleteHotkey,
      getHotkeyText,
      getHotkeyColor,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;
@import "~quasar/src/css/variables";

.setting-card {
  width: 100%;
}
</style>
