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
      <q-header class="q-pa-sm" elevated>
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
            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="text-h5">エンジン</div>
                <div class="text-subtitle2">
                  GPUモードの利用には NVIDIA&trade; GPU が必要です
                </div>
              </q-card-section>
              <q-separator />
              <q-card-actions class="q-px-md">
                <q-option-group
                  v-model="engineMode"
                  :options="[
                    { label: 'CPUモード', value: 'switchCPU' },
                    { label: 'GPUモード', value: 'switchGPU' },
                  ]"
                  type="radio"
                />
              </q-card-actions>
            </q-card>

            <!-- Saving Card -->
            <q-card flat bordered class="setting-card">
              <q-card-section>
                <div class="text-h5">保存</div>
              </q-card-section>
              <q-separator />
              <q-list>
                <q-expansion-item
                  dense
                  dense-toggle
                  expand-separator
                  group="saving-group"
                  label="文字コード"
                  expand-icon-class="text-black"
                >
                  <q-card>
                    <q-card-actions class="q-px-md">
                      <q-option-group
                        type="radio"
                        :options="[
                          { label: 'UTF-8', value: 'UTF-8' },
                          { label: 'Shift_JIS', value: 'Shift_JIS' },
                        ]"
                        :model-value="savingSetting.fileEncoding"
                        @update:model-value="
                          handleSavingSettingChange('fileEncoding', $event)
                        "
                      />
                    </q-card-actions>
                  </q-card>
                </q-expansion-item>

                <q-expansion-item
                  dense
                  dense-toggle
                  expand-separator
                  group="saving-group"
                  label="書き出し先を固定"
                  expand-icon-class="text-black"
                >
                  <q-card>
                    <q-card-section>
                      <q-toggle
                        name="enabled"
                        align="left"
                        label="書き出し先を固定"
                        :model-value="savingSetting.fixedExportEnabled"
                        @update:model-value="
                          handleSavingSettingChange(
                            'fixedExportEnabled',
                            $event
                          )
                        "
                      />
                      <q-input
                        unelevated
                        no-error-icon
                        v-model="savingSetting.fixedExportDir"
                        label="書き出し先のフォルダ"
                        error-message="フォルダが見つかりません"
                        :rules="[inputCheckDirExists]"
                        @update:model-value="
                          handleSavingSettingChange('fixedExportDir', $event)
                        "
                      >
                        <template v-slot:after>
                          <q-btn
                            square
                            dense
                            flat
                            color="primary"
                            icon="folder_open"
                            @click="openFileExplore"
                          >
                            <q-tooltip :delay="500" anchor="bottom right">
                              フォルダ選択
                            </q-tooltip>
                          </q-btn>
                        </template>
                      </q-input>
                      音声ファイルを設定したフォルダに書き出す
                    </q-card-section>
                  </q-card>
                </q-expansion-item>

                <q-expansion-item
                  dense
                  dense-toggle
                  expand-separator
                  group="saving-group"
                  label="上書き防止"
                  expand-icon-class="text-black"
                >
                  <q-card>
                    <q-card-section>
                      <q-checkbox
                        class="q-pl-md q-pb-sm"
                        label="上書き防止"
                        :model-value="savingSetting.avoidOverwrite"
                        @update:model-value="
                          handleSavingSettingChange('avoidOverwrite', $event)
                        "
                      />
                      <div class="q-pt-sm">
                        上書きせずにファイルを連番で保存します
                      </div>
                    </q-card-section>
                  </q-card>
                </q-expansion-item>
              </q-list>
            </q-card>
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, onUpdated } from "vue";
import { useStore } from "@/store";
import { ASYNC_UI_LOCK, SET_USE_GPU } from "@/store/ui";
import { CHECK_FILE_EXISTS, RESTART_ENGINE } from "@/store/audio";
import { useQuasar } from "quasar";
import {
  GET_SAVING_SETTING_DATA,
  SET_SAVING_SETTING_DATA,
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
      if (key === "fixedExportDir") {
        inputCheckDirExists(data.toString()).then((res) => {
          if (res) {
            store.dispatch(SET_SAVING_SETTING_DATA, {
              data: { ...savingSetting.value, [key]: data },
            });
          }
        });
      } else {
        store.dispatch(SET_SAVING_SETTING_DATA, {
          data: { ...savingSetting.value, [key]: data },
        });
      }
    };

    const openFileExplore = async () => {
      const path = await window.electron.showOpenDirectoryDialog({
        title: "書き出し先のフォルダを選択",
      });
      if (path) {
        inputCheckDirExists(path).then((res) => {
          if (res) {
            store.dispatch(SET_SAVING_SETTING_DATA, {
              data: { ...savingSetting.value, fixedExportDir: path },
            });
          }
        });
      }
    };

    const inputCheckDirExists = (dir: string) => {
      return store.dispatch(CHECK_FILE_EXISTS, { file: dir });
    };

    onUpdated(() => {
      store.dispatch(GET_SAVING_SETTING_DATA);
    });

    return {
      settingDialogOpenedComputed,
      engineMode,
      restartEngineProcess,
      savingSetting,
      handleSavingSettingChange,
      openFileExplore,
      inputCheckDirExists,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;
@import "~quasar/src/css/variables";

.setting-card {
  width: 100%;
  max-width: 350px;
  border-color: #aaa;
}
</style>
