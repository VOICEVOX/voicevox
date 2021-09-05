<template>
  <q-dialog
    maximized
    persistent
    class="setting-dialog"
    v-model="settingDialogOpenedComputed"
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-white">
      <q-header class="q-pa-sm" elevated>
        <q-toolbar>
          <q-toolbar-title class="text-secondary">オプション</q-toolbar-title>
          <q-space />
          <!-- colse button -->
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
            <q-card class="setting-card">
              <q-card-section class="bg-nvidia">
                <div class="text-h5">エンジン</div>
                <div class="text-subtitle2">
                  GPUモードには <b>NVIDIA&trade;</b> GPUが必要です
                </div>
              </q-card-section>

              <q-separator />
              <q-card-actions class="q-px-md">
                <q-radio
                  v-model="engineMode"
                  color="green"
                  val="switchCPU"
                  label="CPU"
                />
                <q-radio
                  v-model="engineMode"
                  color="green"
                  val="switchGPU"
                  label="GPU"
                />
              </q-card-actions>
            </q-card>
            <!-- Saving Card -->
            <q-card class="setting-card">
              <q-card-section class="bg-blue">
                <div class="text-h5">保存</div>
              </q-card-section>
              <q-list>
                <q-expansion-item
                  dense
                  dense-toggle
                  expand-separator
                  header-class="bg-blue text-white"
                  group="saving-group"
                  label="文字コード"
                  expand-icon-class="text-white"
                >
                  <q-card>
                    <q-card-section>
                      <q-btn-toggle
                        v-model="fileEncoding"
                        toggle-color="blue"
                        :options="[
                          { label: 'UTF-8', value: 'UTF-8' },
                          { label: 'Shift_JIS', value: 'Shift_JIS' },
                        ]"
                      />
                    </q-card-section>
                  </q-card>
                </q-expansion-item>

                <q-expansion-item
                  dense
                  dense-toggle
                  expand-separator
                  header-class="bg-blue text-white"
                  group="saving-group"
                  label="書き出し先を固定"
                  expand-icon-class="text-white"
                >
                  <q-card>
                    <q-card-section>
                      <q-toggle
                        name="enabled"
                        align="left"
                        dense
                        color="blue"
                        :model-value="simpleMode.enabled"
                        :label="simpleMode.enabled ? '有効' : '無効'"
                        @update:model-value="
                          handleSimpleModeChange('enabled', $event)
                        "
                      />
                      <q-input
                        unelevated
                        dense
                        bottom-slots
                        v-model="simpleMode.dir"
                        label="デフォルトのフォルダ"
                        @update:model-value="
                          handleSimpleModeChange('dir', $event)
                        "
                        color="blue"
                      >
                        <template v-slot:append>
                          <q-btn
                            square
                            dense
                            flat
                            color="blue"
                            icon="folder_open"
                            @click="onOpeningFileExplore"
                          >
                            <q-tooltip
                              :delay="500"
                              class="bg-blue text-body2"
                              anchor="bottom right"
                            >
                              フォルダー選択
                            </q-tooltip>
                          </q-btn>
                        </template>
                      </q-input>
                      設定したフォルダーに書き出す
                    </q-card-section>
                  </q-card>
                </q-expansion-item>

                <q-expansion-item
                  dense
                  dense-toggle
                  expand-separator
                  header-class="bg-blue text-white"
                  group="saving-group"
                  label="上書き防止"
                  expand-icon-class="text-white"
                >
                  <q-card>
                    <q-card-section>
                      <q-checkbox
                        class="q-pl-lg q-pb-md"
                        :label="simpleMode.avoid ? '有効' : '無効'"
                        dense
                        color="blue"
                        :model-value="simpleMode.avoid"
                        @update:model-value="
                          handleSimpleModeChange('avoid', $event)
                        "
                      />
                      <q-separator />
                      <div class="q-pt-sm">
                        上書きの代わりにファイル名に番号をつける
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
import { defineComponent, computed, ref } from "vue";
import { useStore } from "@/store";
import { ASYNC_UI_LOCK, SET_FILE_ENCODING, SET_USE_GPU } from "@/store/ui";
import { Encoding } from "@/type/preload";
import { RESTART_ENGINE } from "@/store/audio";
import { useQuasar } from "quasar";
import { SET_SIMPLE_MODE_DATA } from "@/store/setting";

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
        restartEngineProcess();

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

    const fileEncoding = computed({
      get: () => store.state.fileEncoding,
      set: (encoding: Encoding) =>
        store.dispatch(SET_FILE_ENCODING, {
          encoding: encoding,
        }),
    });

    const restartEngineProcess = () => {
      store.dispatch(RESTART_ENGINE);
    };

    const simpleMode = computed(() => store.state.simpleMode);

    const handleSimpleModeChange = (key: string, data: string) => {
      console.log(key);
      console.log(data);
      store.dispatch(SET_SIMPLE_MODE_DATA, {
        data: { ...simpleMode.value, [key]: data },
      });
    };

    const onOpeningFileExplore = async () => {
      const path = await window.electron.showOpenDirectoryDialog({
        title: "デフォルトのフォルダーを選択",
      });
      if (path) {
        store.dispatch(SET_SIMPLE_MODE_DATA, {
          data: { ...simpleMode.value, dir: path },
        });
      }
    };

    return {
      settingDialogOpenedComputed,
      engineMode,
      fileEncoding,
      restartEngineProcess,
      simpleMode: ref(simpleMode),
      handleSimpleModeChange,
      onOpeningFileExplore,
      tab: ref("encoding"),
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

.setting-card {
  width: 100%;
  max-width: 265px;
}

.text-nvidia {
  color: #76b900;
}

.bg-nvidia {
  background: #76b900;
}
</style>
