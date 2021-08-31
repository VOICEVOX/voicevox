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
                <div class="q-pl-lg">
                  <q-btn label="再起動" color="green" @click="restartEngine" />
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
import { SET_FILE_ENCODING } from "@/store/ui";
import { Encoding } from "@/type/preload";
import { RESTART_ENGINE } from "@/store/audio";

export default defineComponent({
  name: "SettingDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const settingDialogOpenedComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const store = useStore();

    const engineMode = computed({
      get: () => (store.state.useGpu ? "switchGPU" : "switchCPU"),
      set: (mode: string) => {
        emit(mode);
      },
    });

    const fileEncoding = computed({
      get: () => store.state.fileEncoding,
      set: (encoding: Encoding) =>
        store.dispatch(SET_FILE_ENCODING, {
          encoding: encoding,
        }),
    });

    const restartEngine = () => {
      store.dispatch(RESTART_ENGINE);
    };

    return {
      settingDialogOpenedComputed,
      engineMode,
      fileEncoding,
      restartEngine,
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
