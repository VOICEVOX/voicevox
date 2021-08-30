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
          <!-- Engine Mode Card -->
          <q-card class="setting-card">
            <q-card-section class="bg-nvidia">
              <div class="text-h5">エンジン</div>
              <div class="text-subtitle2">
                GPUモードには <b>NVIDIA&trade;</b> GPUが必要です
              </div>
            </q-card-section>

            <q-separator />
            <q-card-actions class="q-pa-mdi">
              <q-toggle
                v-model="engineMode"
                :label="(engineMode ? 'GPU' : 'CPU') + ' モード'"
                icon="loop"
                color="green"
              />
              <q-btn flat label="再起動" color="green" @click="restart" />
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
                push
                flat
                toggle-color="blue"
                :options="[
                  { label: 'Shift_JIS', value: 'Shift_JIS' },
                  { label: 'UTF-8', value: 'UTF-8' },
                ]"
              />
            </div>
          </q-card>
          <!-- close button -->
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
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import { SET_FILE_ENCODING } from "@/store/ui";

type Encoding = "UTF-8" | "Shift_JIS";

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

    const engineMode = computed({
      get: () => store.state.useGpu,
      set: (mode: boolean) => {
        emit(mode ? "switchGPU" : "switchCPU");
      },
    });

    const fileEncoding = computed({
      get: () => store.state.fileEncoding,
      set: (encoding: Encoding) =>
        store.dispatch(SET_FILE_ENCODING, {
          encoding: encoding,
        }),
    });

    const restart = () => {
      emit("restart");
    };

    return {
      modelValueComputed,
      engineMode,
      fileEncoding,
      restart,
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
