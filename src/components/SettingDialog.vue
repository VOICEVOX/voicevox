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
                <div class="q-pl-md">
                  <q-btn
                    size="md"
                    padding="xs md"
                    label="再起動"
                    color="green"
                    @click="restartEngineProcess"
                  />
                </div>
              </q-card-actions>
            </q-card>

            <!-- File Encoding Card -->
            <q-card class="setting-card">
              <q-card-section class="bg-blue">
                <div class="text-h5">文字コード</div>
              </q-card-section>

              <q-separator />

              <div class="q-pa-md">
                <q-btn-toggle
                  v-model="fileEncoding"
                  toggle-color="blue"
                  :options="[
                    { label: 'UTF-8', value: 'UTF-8' },
                    { label: 'Shift_JIS', value: 'Shift_JIS' },
                  ]"
                />
              </div>
            </q-card>
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { ASYNC_UI_LOCK, SET_FILE_ENCODING, SET_USE_GPU } from "@/store/ui";
import { Encoding } from "@/type/preload";
import { RESTART_ENGINE } from "@/store/audio";
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

    return {
      settingDialogOpenedComputed,
      engineMode,
      fileEncoding,
      restartEngineProcess,
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
