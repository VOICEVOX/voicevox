<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog"
    v-model="settingDialogOpenedComputed"
    @show="restorePos"
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
              @click="settingDialogOpenedComputed = false"
            />
          </q-toolbar>
        </q-header>
        <q-page class="scroller scroll">
          <q-scroll-observer @scroll="onScroll" />
          <div id="scroller" class="q-pa-md row items-start q-gutter-md">
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
              <!-- FIXME: バージョン0.8.0現在、エンジン側にサンプリングレート変更エラーがあるので機能制限 -->
              <!-- <q-card-actions class="q-px-md q-py-none bg-grey-3">
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
                    音声のサンプリングレートを変更して再生・保存しますが、音声の品質は大きく変わりません
                  </q-tooltip>
                </q-select>
              </q-card-actions> -->
            </q-card>
            <!-- 今後実験的機能を追加する場合はここに追加 -->
            <q-card flat class="setting-card">
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
import { useQuasar, debounce, scroll } from "quasar";
import { QuasarScrollObserverEvent, SavingSetting } from "@/type/preload";

export default defineComponent({
  name: "SettingDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const { getScrollTarget, setVerticalScrollPosition } = scroll;
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
    const inheritAudioInfoMode = computed(() => store.state.inheritAudioInfo);

    const scrollPos = ref(0);

    const onScroll = (evt: QuasarScrollObserverEvent) => {
      scrollPos.value = evt.position.top;
    };

    const restorePos = () => {
      const target = document.getElementById("scroller");
      if (target)
        setVerticalScrollPosition(
          getScrollTarget(target),
          scrollPos.value,
          150
        );
    };

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

    const changeUseGPU = async (useGpu: boolean) => {
      if (store.state.useGpu === useGpu) return;

      const change = async () => {
        await store.dispatch("SET_USE_GPU", { useGpu });
        store.dispatch("RESTART_ENGINE");

        $q.dialog({
          title: "エンジンの起動モードを変更しました",
          message: "変更を適用するためにエンジンを再起動します。",
          ok: {
            flat: true,
            textColor: "display",
          },
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
            textColor: "display",
          },
          cancel: {
            label: "変更しない",
            flat: true,
            textColor: "display",
          },
        }).onOk(change);
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
        $q.dialog({
          title: "出力サンプリングレートを変更します",
          message:
            "出力サンプリングレートを変更しても、音質は変化しません。また、音声の生成処理に若干時間がかかる場合があります。<br />本当に変更しますか？",
          html: true,
          persistent: true,
          ok: {
            label: "変更する",
            flat: true,
            textColor: "display",
          },
          cancel: {
            label: "変更しない",
            flat: true,
            textColor: "display",
          },
        }).onOk(storeDispatch);
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
      settingDialogOpenedComputed,
      engineMode,
      inheritAudioInfoMode,
      changeinheritAudioInfo,
      restartEngineProcess,
      savingSetting,
      handleSavingSettingChange,
      openFileExplore,
      currentThemeNameComputed,
      currentThemeComputed,
      availableThemeNameComputed,
      onScroll: debounce(onScroll, 200),
      restorePos,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;
@import "~quasar/src/css/variables";

.hotkey-table {
  width: 100%;
}

.setting-card {
  @extend .hotkey-table;
  min-width: 475px;
  background: var(--color-background);
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
