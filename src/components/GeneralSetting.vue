<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar color="transparent">
        <q-toolbar-title class="text-secondary">通常設定</q-toolbar-title>
      </q-toolbar>
    </q-header>
    <q-page class="scroller">
      <div class="q-pa-md row items-start q-gutter-md">
        <q-card class="setting-card">
          <q-card-section class="bg-nvidia">
            <div class="text-h5">エンジン</div>
          </q-card-section>

          <q-separator />

          <div class="q-pa-md">
            <q-toggle
              v-model="engine_mode"
              :label="(engine_mode ? 'GPU' : 'CPU') + ' Mode'"
              icon="loop"
              color="green"
              @update:model-value="changeUseGPU(engine_mode)"
            >
              <q-tooltip
                v-if="!engine_mode"
                class="bg-green text-body2"
                anchor="bottom right"
              >
                You'll need a NVIDIA&trade; GPU to enable GPU mode
              </q-tooltip>
            </q-toggle>
          </div>
        </q-card>

        <q-card class="setting-card">
          <q-card-section class="bg-blue">
            <div class="text-h5">File Encoding</div>
            <div class="text-subtitle2">
              This will affect the text file you export with audio
            </div>
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
          </q-card-section>

          <q-separator />

          <q-card-actions align="left">
            <q-toggle
              dense
              color="pink-4"
              v-model="simple_mode"
              :label="simple_mode ? 'enabled' : 'disabled'"
            >
              <q-tooltip
                v-if="!simple_mode"
                class="bg-pink-4 text-body2"
                anchor="bottom right"
              >
                Set a default export directory and export without being <br />
                asked everytime
              </q-tooltip>
            </q-toggle>
            <q-input
              unelevated
              dense
              bottom-slots
              v-model="dir"
              label="Output Directory"
              :readonly="!simple_mode"
              color="pink-5"
            >
              <template v-slot:append>
                <q-btn
                  square
                  dense
                  flat
                  color="pink-5"
                  icon="folder_open"
                  :disable="!simple_mode"
                  @click="onOpeningFileExplore"
                >
                  <q-tooltip class="bg-pink-4 text-body2" anchor="bottom right">
                    Explore
                  </q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </q-card-actions>
        </q-card>
        <q-card class="setting-card">
          <q-card-section class="bg-amber">
            <div class="text-h5">Restore Default</div>
            <div class="text-subtitle2">
              Current setting <b>except</b> <br />Engine Mode will be lost
            </div>
          </q-card-section>

          <q-separator />

          <q-toggle v-model="unlock" label="I understand" color="amber" />
          <q-card-actions align="right">
            <q-btn
              :disable="!unlock"
              color="amber"
              text-color="black"
              @click="resetSetting"
            >
              Restore
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
    </q-page>
  </div>
</template>

<script lang="ts">
// TODO: engine, simple mode & its base dir settings
import { ASYNC_UI_LOCK, SET_FILE_ENCODING, SET_USE_GPU } from "@/store/ui";
import { useQuasar } from "quasar";
import { computed, defineComponent, ref } from "vue";
import { useStore } from "@/store";
import { RESET_SETTING, SET_SIMPLE_MODE_DATA } from "@/store/setting";
export default defineComponent({
  name: "GeneralSetting",
  setup() {
    const store = useStore();
    const $q = useQuasar();
    const engineMode = ref(computed(() => store.state.useGpu).value);

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

    const onOpeningFileExplore = () => {
      store.dispatch(SET_SIMPLE_MODE_DATA);
    };

    const resetSetting = () => {
      store.dispatch(RESET_SETTING);
    };

    return {
      engine_mode: engineMode,
      text_encoding: ref(textEncoding.value),
      simple_mode: ref(false),
      unlock: ref(false),
      dir: ref(""),
      changeUseGPU,
      changeTextEncoding,
      onOpeningFileExplore,
      resetSetting,
    };
  },
});
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}
.setting-card {
  width: 100%;
  max-width: 240px;
}

.text-nvidia {
  color: #76b900;
}

.bg-nvidia {
  background: #76b900;
}
</style>
