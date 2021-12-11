<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog"
    ref="dialogRef"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-background">
      <q-page-container class="root">
        <q-header class="q-pa-sm">
          <q-toolbar>
            <q-toolbar-title class="text-display"
              >設定 / オプション</q-toolbar-title
            >
            <q-space />
            <!-- close button -->
            <q-btn
              round
              flat
              icon="close"
              color="display"
              @click="onDialogOK"
            />
          </q-toolbar>
        </q-header>
        <q-page ref="scroller" class="scroller">
          <div class="q-pa-md row items-start q-gutter-md">
            <!-- Engine Mode Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">エンジン</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-setting-item">
                <div>エンジンモード</div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  v-model="engineMode"
                  color="white"
                  text-color="black"
                  toggle-color="primary"
                  toggle-text-color="display"
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
            <!-- Preservation Setting -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">操作</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-setting-item">
                <div>パラメータの引き継ぎ</div>
                <q-space />
                <q-toggle
                  :model-value="inheritAudioInfoMode"
                  @update:model-value="changeinheritAudioInfo($event)"
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    テキスト欄を追加する際、現在の話速等のパラメータを引き継ぎます
                  </q-tooltip>
                </q-toggle>
              </q-card-actions>
            </q-card>
            <!-- Saving Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">保存</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-setting-item">
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
                  toggle-text-color="display"
                  :options="[
                    { label: 'UTF-8', value: 'UTF-8' },
                    { label: 'Shift_JIS', value: 'Shift_JIS' },
                  ]"
                />
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
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

              <q-card-actions class="q-px-md q-py-none bg-setting-item">
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
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>labファイルを生成</div>
                <q-space />
                <q-toggle
                  name="enabled"
                  align="left"
                  :model-value="savingSetting.exportLab"
                  @update:model-value="
                    handleSavingSettingChange('exportLab', $event)
                  "
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    リップシンク用のlabファイルを生成します
                  </q-tooltip>
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>txtファイルを書き出し</div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.exportText"
                  @update:model-value="
                    handleSavingSettingChange('exportText', $event)
                  "
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    テキストをtxtファイルとして書き出します
                  </q-tooltip>
                </q-toggle>
              </q-card-actions>
            </q-card>
            <!-- Experimental Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">高度な設定</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>音声をステレオ化</div>
                <q-space />
                <q-toggle
                  name="enabled"
                  align="left"
                  :model-value="savingSetting.outputStereo"
                  @update:model-value="
                    handleSavingSettingChange('outputStereo', $event)
                  "
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    音声データをモノラルからステレオに変換してから再生・保存を行います
                  </q-tooltip>
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>再生デバイス</div>
                <q-space />
                <q-select
                  dense
                  v-model="currentAudioOutputDeviceComputed"
                  label="再生デバイス"
                  :options="availableAudioOutputDevices"
                  class="col-7"
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    音声の再生デバイスを変更し再生を行います
                  </q-tooltip>
                </q-select>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-grey-3">
                <div>音声のサンプリングレート</div>
                <q-space />
                <q-select
                  borderless
                  name="samplingRate"
                  :model-value="savingSetting.outputSamplingRate"
                  :options="[24000, 44100, 48000, 88200, 96000]"
                  :option-label="
                    (item) =>
                      `${item / 1000} kHz${
                        item === 24000 ? '(デフォルト)' : ''
                      }`
                  "
                  @update:model-value="
                    handleSavingSettingChange('outputSamplingRate', $event)
                  "
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    再生・保存時の音声のサンプリングレートを変更します（サンプリングレートを上げても音声の品質は上がりません。）
                  </q-tooltip>
                </q-select>
              </q-card-actions>
            </q-card>
            <!-- 今後実験的機能を追加する場合はここに追加 -->
            <!-- FIXME: 0.9.1に間に合わなかったのでダークモード機能を一旦省きました -->
            <!-- <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">実験的機能</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-setting-item">
                <div>Theme</div>
                <q-space />
                <q-btn-toggle
                  unelevated
                  padding="xs md"
                  color="white"
                  text-color="black"
                  toggle-color="primary"
                  toggle-text-color="display"
                  v-model="currentThemeNameComputed"
                  :options="availableThemeNameComputed"
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    The colors in themes are not decided yet
                  </q-tooltip>
                </q-btn-toggle>
              </q-card-actions>
            </q-card> -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">テレメトリー</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>テレメトリーの収集を許可する</div>
                <q-space />
                <q-toggle
                  name="enabled"
                  align="left"
                  v-model="acceptRetrieveTelemetryComputed"
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    VOICEVOXの改善のため、ウインドウサイズや各UIの利用率などの収集を許可します
                  </q-tooltip>
                </q-toggle>
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
import { useQuasar, useDialogPluginComponent } from "quasar";
import { SavingSetting } from "@/type/preload";
import { useGtm } from "@gtm-support/vue-gtm";

export default defineComponent({
  name: "SettingDialog",

  setup() {
    const { dialogRef, onDialogOK } = useDialogPluginComponent();
    const store = useStore();
    const $q = useQuasar();

    const engineMode = computed({
      get: () => (store.state.useGpu ? "switchGPU" : "switchCPU"),
      set: (mode: string) => {
        changeUseGPU(mode == "switchGPU" ? true : false);
      },
    });
    const inheritAudioInfoMode = computed(() => store.state.inheritAudioInfo);

    const currentThemeNameComputed = computed({
      get: () => store.state.themeSetting.currentTheme,
      set: (currentTheme: string) => {
        store.dispatch("SET_THEME_SETTING", { currentTheme: currentTheme });
      },
    });

    const currentThemeComputed = computed(() =>
      store.state.themeSetting.availableThemes.find((value) => {
        return value.name == currentThemeNameComputed.value;
      })
    );

    const availableThemeNameComputed = computed(() => {
      return store.state.themeSetting.availableThemes.map((theme) => {
        return { label: theme.name, value: theme.name };
      });
    });

    const currentAudioOutputDeviceComputed = computed<{
      key: string;
      label: string;
    } | null>({
      get: () => {
        // 再生デバイスが見つからなかったらデフォルト値に戻す
        const device = availableAudioOutputDevices.value?.find(
          (device) => device.key === store.state.savingSetting.audioOutputDevice
        );
        if (device) {
          return device;
        } else {
          handleSavingSettingChange("audioOutputDevice", "default");
          return null;
        }
      },
      set: (device) => {
        if (device) {
          handleSavingSettingChange("audioOutputDevice", device.key);
        }
      },
    });

    const availableAudioOutputDevices = ref<{ key: string; label: string }[]>();
    const updateAudioOutputDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      availableAudioOutputDevices.value = devices
        .filter((device) => device.kind === "audiooutput")
        .map((device) => {
          return { label: device.label, key: device.deviceId };
        });
    };
    navigator.mediaDevices.addEventListener(
      "devicechange",
      updateAudioOutputDevices
    );
    updateAudioOutputDevices();

    const gtm = useGtm();
    const acceptRetrieveTelemetryComputed = computed({
      get: () => store.state.acceptRetrieveTelemetry == "Accepted",
      set: (acceptRetrieveTelemetry: boolean) => {
        store.dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
          acceptRetrieveTelemetry: acceptRetrieveTelemetry
            ? "Accepted"
            : "Refused",
        });
        gtm?.enable(acceptRetrieveTelemetry);

        if (acceptRetrieveTelemetry) {
          return;
        }

        store.dispatch("OPEN_COMMON_DIALOG", {
          title: "テレメトリーの収集の無効化",
          message:
            "テレメトリーの収集を完全に無効にするには、VOICEVOXを再起動する必要があります。",
        });
      },
    });

    const changeUseGPU = async (useGpu: boolean) => {
      if (store.state.useGpu === useGpu) return;

      const change = async () => {
        await store.dispatch("SET_USE_GPU", { useGpu });
        store.dispatch("RESTART_ENGINE");

        store.dispatch("OPEN_COMMON_DIALOG", {
          title: "エンジンの起動モードを変更しました",
          message: "変更を適用するためにエンジンを再起動します。",
        });
      };

      const isAvailableGPUMode = await new Promise<boolean>((resolve) => {
        store.dispatch("ASYNC_UI_LOCK", {
          callback: async () => {
            $q.loading.show({
              spinnerColor: "primary",
              spinnerSize: 50,
              boxClass: "bg-background text-display",
              message: "起動モードを変更中です",
            });
            resolve(await window.electron.isAvailableGPUMode());
            $q.loading.hide();
          },
        });
      });

      if (useGpu && !isAvailableGPUMode) {
        store
          .dispatch("OPEN_COMMON_DIALOG", {
            title: "対応するGPUデバイスが見つかりません",
            message:
              "GPUモードの利用には、メモリが3GB以上あるNVIDIA製GPUが必要です。\n" +
              "このままGPUモードに変更するとエンジンエラーが発生する可能性があります。\n" +
              "本当に変更しますか？",
            cancelable: true,
            persistent: true,
          })
          .then((result) => {
            if (!result || result.result !== "ok") return;
            change();
          });
      } else change();
    };

    const changeinheritAudioInfo = async (inheritAudioInfo: boolean) => {
      if (store.state.inheritAudioInfo === inheritAudioInfo) return;
      store.dispatch("SET_INHERIT_AUDIOINFO", { inheritAudioInfo });
    };

    const restartEngineProcess = () => {
      store.dispatch("RESTART_ENGINE");
    };

    const savingSetting = computed(() => store.state.savingSetting);

    const handleSavingSettingChange = (
      key: keyof SavingSetting,
      data: string | boolean | number
    ) => {
      const storeDispatch = (): void => {
        store.dispatch("SET_SAVING_SETTING", {
          data: { ...savingSetting.value, [key]: data },
        });
      };
      if (key === "outputSamplingRate" && data !== 24000) {
        store
          .dispatch("OPEN_COMMON_DIALOG", {
            title: "出力サンプリングレートを変更します",
            message:
              "出力サンプリングレートを変更しても、音質は変化しません。また、音声の生成処理に若干時間がかかる場合があります。\n変更しますか？",
            cancelable: true,
            persistent: true,
            okButtonText: "変更する",
            cancelButtonText: "変更しない",
          })
          .then((result) => {
            if (!result || result.result !== "ok") return;
            storeDispatch();
          });
        return;
      }
      storeDispatch();
    };

    const openFileExplore = async () => {
      const path = await window.electron.showOpenDirectoryDialog({
        title: "書き出し先のフォルダを選択",
      });
      if (path) {
        store.dispatch("SET_SAVING_SETTING", {
          data: { ...savingSetting.value, fixedExportDir: path },
        });
      }
    };

    return {
      dialogRef,
      onDialogOK,
      engineMode,
      inheritAudioInfoMode,
      currentAudioOutputDeviceComputed,
      availableAudioOutputDevices,
      changeinheritAudioInfo,
      restartEngineProcess,
      savingSetting,
      handleSavingSettingChange,
      openFileExplore,
      currentThemeNameComputed,
      currentThemeComputed,
      availableThemeNameComputed,
      acceptRetrieveTelemetryComputed,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.hotkey-table {
  width: 100%;
}

.setting-card {
  @extend .hotkey-table;
  min-width: 475px;
  background: colors.$background;
}

.setting-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  .scroll {
    left: unset !important;
    right: unset !important;
    width: unset !important;
    max-height: unset;
  }
}

.root {
  .scroller {
    overflow-y: scroll;
    > div {
      position: absolute;
      left: 0;
      right: 0;
    }
  }
}
</style>
