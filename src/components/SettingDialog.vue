<template>
  <q-dialog
    maximized
    persistent
    class="setting-dialog"
    v-model="modelValueComputed"
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-layout container view="hhh lpr fFf" class="bg-white">
      <q-footer reveal elevated>
        <q-toolbar>
          <q-toolbar-title class="text-secondary">オプション</q-toolbar-title>
        </q-toolbar>
      </q-footer>
      <q-page
        ref="scroller"
        class="relative-absolute-wrapper scroller"
        display="flex"
      >
        <div class="q-pa-md row items-start q-gutter-md">
          <q-card class="setting-card">
            <q-card-section class="bg-nvidia">
              <div class="text-h5">エンジン</div>
              <div class="text-subtitle2">
                GPUモードには <b>NVIDIA&trade;</b> GPUが必要です
              </div>
            </q-card-section>

            <q-separator />

            <div class="q-pa-md">
              <q-toggle
                v-model="engine_mode"
                :label="(engine_mode ? 'GPU' : 'CPU') + ' モード'"
                icon="loop"
                color="green"
                @update:model-value="changeUseGPU(engine_mode)"
              >
              </q-toggle>
            </div>
          </q-card>

          <q-card class="setting-card">
            <q-card-section class="bg-blue">
              <div class="text-h5">文字コード</div>
            </q-card-section>

            <q-separator />

            <div class="q-pa-md">
              <q-btn-toggle
                v-model="text_encoding"
                push
                flat
                toggle-color="blue"
                :options="[
                  { label: 'Shift-JIS', value: 'Shift_JIS' },
                  { label: 'UTF-8', value: 'UTF-8' },
                ]"
                @update:model-value="changeTextEncoding"
              />
            </div>
          </q-card>

          <q-card class="setting-card">
            <q-card-section class="bg-pink-4">
              <div class="text-h5">シンプルモード</div>
              <div class="text-subtitle2">
                デフォルトのフォルダに自動的に書き出す
              </div>
            </q-card-section>

            <q-separator />

            <q-card-actions align="left" vertical>
              <div class="q-pa-sm">
                <q-toggle
                  align="left"
                  dense
                  color="pink-4"
                  v-model="simple_mode.enabled"
                  :label="simple_mode.enabled ? '有効' : '無効'"
                  @click="handleSimpleModeChange()"
                >
                </q-toggle>
                <q-input
                  unelevated
                  dense
                  bottom-slots
                  v-model="simple_mode.dir"
                  label="デフォルトのフォルダ"
                  :readonly="!simple_mode.enabled"
                  @change="handleSimpleModeChange"
                  color="pink-5"
                >
                  <template v-slot:append>
                    <q-btn
                      square
                      dense
                      flat
                      color="pink-5"
                      icon="folder_open"
                      :disable="!simple_mode.enabled"
                      @click="onOpeningFileExplore"
                    >
                      <q-tooltip
                        class="bg-pink-4 text-body2"
                        anchor="bottom right"
                      >
                        フォルダ選択
                      </q-tooltip>
                    </q-btn>
                  </template>
                </q-input>
              </div>
            </q-card-actions>
          </q-card>

          <q-card class="setting-card">
            <q-card-section class="bg-brown-5">
              <div class="text-h5">マウスホイール</div>
            </q-card-section>
            <q-separator />
            <q-list dense class="q-pa-sm">
              <q-item>
                <q-item-section>
                  <q-item-label>操作</q-item-label>
                </q-item-section>
                <q-item-section>
                  <q-item-label>有効</q-item-label>
                </q-item-section>
                <q-item-section>
                  <q-item-label>反転</q-item-label>
                </q-item-section>
              </q-item>
              <q-item v-for="setting in mouseWheelSetting" :key="setting.id">
                <q-item-section>
                  <q-item-label>{{
                    mouseWheelReference[parseInt(setting.id)]
                  }}</q-item-label>
                </q-item-section>
                <q-item-section>
                  <q-checkbox
                    dense
                    color="brown"
                    v-model="setting.enabled"
                    @click="handelMouseWheelSettingClicked(setting.id)"
                  />
                </q-item-section>
                <q-item-section>
                  <q-checkbox
                    dense
                    color="brown"
                    v-model="setting.reversed"
                    :disable="!setting.enabled"
                    @click="handelMouseWheelSettingClicked(setting.id)"
                  />
                </q-item-section>
              </q-item>
            </q-list>
          </q-card>

          <q-card class="hoykey-card">
            <q-card-section class="bg-purple-5">
              <div class="text-h5">ショートカット</div>
              <div class="text-subtitle2">
                クリックで設置、ダブルクリックで解除
              </div>
            </q-card-section>

            <q-separator />

            <q-table
              dense
              :filter="filter"
              :rows="rows"
              :columns="columns"
              :rows-per-page-options="[]"
              row-key="index"
              v-model:pagination="pagination"
            >
              <template v-slot:top>
                <q-space />
                <q-input dense v-model="filter" label="検索" color="purple-5">
                  <template v-slot:append>
                    <q-icon name="search" />
                  </template>
                </q-input>
              </template>
              <template v-slot:body="props">
                <q-tr :props="props">
                  <q-td key="action" :props="props">
                    {{ props.row.action }}
                  </q-td>
                  <q-td
                    key="combination"
                    :props="props"
                    :id="props.row.id"
                    @click="handleRecording($event, props.row.id)"
                    @dblclick="removeHotkey(props.row.id)"
                  >
                    {{
                      (disabledHotkeys.indexOf(props.row.id) > -1
                        ? "(read only) "
                        : "") +
                      (props.row.combination === ""
                        ? "未設定"
                        : props.row.combination)
                    }}
                  </q-td>
                </q-tr>
              </template>
            </q-table>
          </q-card>
          <q-page-sticky position="top-right" :offset="[20, 20]">
            <q-btn
              round
              color="primary"
              icon="close"
              @click="modelValueComputed = false"
            />
          </q-page-sticky>
        </div>
      </q-page>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from "vue";
import {
  OPEN_FILE_EXPLORE,
  SET_HOTKEY_SETTING,
  SET_SIMPLE_MODE_DATA,
  SET_WHEEL_SETTING,
} from "@/store/setting";
import { ASYNC_UI_LOCK, SET_FILE_ENCODING, SET_USE_GPU } from "@/store/ui";
import { useStore } from "@/store";
import { useQuasar } from "quasar";

export default defineComponent({
  name: "SettingDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const modelValueComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const store = useStore();
    const $q = useQuasar();
    const engineMode = ref(computed(() => store.state.useGpu).value);

    const columns = [
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
    ];

    const changeUseGPU = async (useGpu: boolean) => {
      if (store.state.useGpu === useGpu) return;

      const change = async () => {
        await store.dispatch(SET_USE_GPU, { useGpu });
        $q.dialog({
          title: "エンジンの起動モードを変更しました",
          message: "変更を適用するためにVOICEVOXを再起動してください。",
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
        })
          .onOk(change)
          .onCancel(resetToggle);
      } else change();
    };

    const resetToggle = () => {
      engineMode.value = false;
    };

    const textEncoding = computed(() => store.state.fileEncoding);
    const changeTextEncoding = (encoding: string) => {
      store.dispatch(SET_FILE_ENCODING, {
        encoding: encoding,
      });
    };

    const simpleModeSetting = ref(computed(() => store.state.simpleMode));

    const handleSimpleModeChange = () => {
      store.dispatch(SET_SIMPLE_MODE_DATA, {
        data: {
          enabled: simpleModeSetting.value.enabled,
          dir: simpleModeSetting.value.dir,
        },
      });
    };

    const onOpeningFileExplore = () => {
      store.dispatch(OPEN_FILE_EXPLORE);
    };

    let lastHotkey: string | null = null;
    let lastRecord = "";

    const hotkey_rows = ref(computed(() => store.state.hotkeySetting));

    // these are ids of disabled hotkeys, only for display
    // they don't have an easy to implement but still useful
    const disabledHotkeys = ["6", "7", "8"];

    const handleRecording = (event: MouseEvent, id: string) => {
      if (disabledHotkeys.indexOf(id) > -1) {
        return;
      }
      if (event.target instanceof HTMLElement) {
        if (lastHotkey === null) {
          lastRecord = hotkey_rows.value[parseInt(id)].combination;
          lastHotkey = id;
          event.target.style.color = "grey";
        } else if (lastHotkey != id) {
          return;
        } else {
          changeHotkey(lastHotkey, lastRecord);
          lastHotkey = null;
          event.target.style.color = "black";
        }
      }
    };

    const recordCombination = (event: KeyboardEvent) => {
      if (lastHotkey === null) {
        return;
      } else {
        let recorded = "";
        if (event.altKey) {
          recorded += "Alt ";
        }
        if (event.ctrlKey) {
          recorded += "Ctrl ";
        }
        if (event.shiftKey) {
          recorded += "Shift ";
        }
        if (event.key === " ") {
          recorded += "space";
        } else {
          recorded +=
            event.key.length > 1 ? event.key : event.key.toUpperCase();
        }
        const hotkey = document.getElementById(lastHotkey);
        if (hotkey instanceof HTMLElement) {
          hotkey.style.color = "teal";
          hotkey.innerHTML = recorded;
          lastRecord = recorded;
        }
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", recordCombination);

    const removeHotkey = (id: string) => {
      if (!(disabledHotkeys.indexOf(id) > -1)) {
        changeHotkey(id, "");
      }
    };

    const changeHotkey = (hotkey_id: string, combination: string) => {
      const id = parseInt(hotkey_id);
      let flag = true;
      for (let i = 0; i < hotkey_rows.value.length; i++) {
        if (
          hotkey_rows.value[i].combination == combination &&
          i != id &&
          combination !== ""
        ) {
          flag = false;
          $q.dialog({
            title: "Duplicated Hotkey",
            message:
              "設置するショートカットキー <b>" +
              combination +
              ": " +
              hotkey_rows.value[id].action +
              "</b> は <b>" +
              hotkey_rows.value[i].action +
              "</b>と同じです、削除しますか？",
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
          })
            .onOk(() => {
              confirmHotkeyChange("", i);
              rollbackHotkey("", i);
              confirmHotkeyChange(combination, id);
            })
            .onCancel(() =>
              rollbackHotkey(hotkey_rows.value[id].combination, id)
            );
        }
      }
      if (flag) {
        confirmHotkeyChange(combination, id);
      }
    };

    const confirmHotkeyChange = (combination: string, id: number) => {
      store.dispatch(SET_HOTKEY_SETTING, {
        combination: combination,
        id: id,
      });
    };

    function rollbackHotkey(combination: string, id: number) {
      const rollbackHotkeyElement = document.getElementById(id.toString());
      if (rollbackHotkeyElement instanceof HTMLElement) {
        rollbackHotkeyElement.innerHTML =
          combination == "" ? "未設定" : combination;
      }
    }

    const mouseWheelSetting = ref(
      computed(() => store.state.mouseWheelSetting)
    );

    const mouseWheelReference = [
      "話速",
      "音高",
      "抑揚",
      "音量",
      "ｱｸｾﾝﾄ",
      "ｲﾝﾄﾈｰｼｮﾝ",
    ];

    function handelMouseWheelSettingClicked(id: number) {
      store.dispatch(SET_WHEEL_SETTING, {
        enabled: mouseWheelSetting.value[id].enabled,
        reversed: mouseWheelSetting.value[id].reversed,
        id: id,
      });
    }
    return {
      modelValueComputed,
      engine_mode: engineMode,
      text_encoding: ref(textEncoding.value),
      simple_mode: simpleModeSetting,
      unlock: ref(false),
      dir: ref(""),
      changeUseGPU,
      changeTextEncoding,
      onOpeningFileExplore,
      rows: hotkey_rows,
      columns: ref(columns),
      handleRecording,
      removeHotkey,
      mouseWheelSetting,
      mouseWheelReference,
      handelMouseWheelSettingClicked,
      disabledHotkeys,
      handleSimpleModeChange,
      pagination: ref({
        rowsPerPage: 5,
      }),
      filter: ref(""),
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

.setting-dialog .q-layout-container ::v-deep .absolute-full {
  right: 0 !important;
  .scroll {
    left: unset !important;
    right: unset !important;
    width: unset !important;
    max-height: unset;
  }
}

.selected-item {
  background-color: rgba(global.$primary, 0.4);
  color: global.$secondary;
}

.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}

.setting-card {
  width: 100%;
  max-width: 265px;
}

.hotkey-card {
  width: 100%;
  max-width: 300px;
}

.text-nvidia {
  color: #76b900;
}

.bg-nvidia {
  background: #76b900;
}
</style>
