<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog"
    v-model="settingDialogOpenedComputed"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-background">
      <q-page-container class="root">
        <q-header class="q-pa-sm">
          <q-toolbar>
            <q-breadcrumbs
              class="text-display"
              active-color="display"
              style="font-size: 20px"
            >
              <q-breadcrumbs-el :label="t('setting_dialog.root')" />
              <q-breadcrumbs-el :label="t('setting_dialog.title')" />
            </q-breadcrumbs>
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
        <q-page ref="scroller" class="scroller">
          <div class="q-pa-md row items-start q-gutter-md">
            <!-- Engine Mode Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">
                  {{ t("setting_dialog.engine.title") }}
                </div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-setting-item">
                <div>{{ t("setting_dialog.engine.engine_mode.label") }}</div>
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
                    v-html="t('setting_dialog.engine.engine_mode.tip')"
                  />
                </q-btn-toggle>
              </q-card-actions>
            </q-card>
            <!-- Preservation Setting -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">
                  {{ t("setting_dialog.operation.title") }}
                </div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-setting-item">
                <div>
                  {{ t("setting_dialog.operation.inherit_parameter.label") }}
                </div>
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
                    v-html="t('setting_dialog.operation.inherit_parameter.tip')"
                  />
                </q-toggle>
              </q-card-actions>
            </q-card>
            <!-- Saving Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">
                  {{ t("setting_dialog.saving.title") }}
                </div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-setting-item">
                <div>{{ t("setting_dialog.saving.encoding.label") }}</div>
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
                <div>
                  {{ t("setting_dialog.saving.fix_export_dir.label") }}
                </div>
                <q-space />
                <q-input
                  dense
                  v-if="savingSetting.fixedExportEnabled"
                  maxheight="10px"
                  :label="t('setting_dialog.saving.fix_export_dir.input_label')"
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
                        {{
                          t(
                            "setting_dialog.saving.fix_export_dir.explore_folder"
                          )
                        }}
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
                    v-html="t('setting_dialog.saving.fix_export_dir.tip')"
                  />
                </q-toggle>
              </q-card-actions>

              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>
                  {{ t("setting_dialog.saving.avoid_overwrite.label") }}
                </div>
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
                    v-html="t('setting_dialog.saving.avoid_overwrite.tip')"
                  />
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>
                  {{ t("setting_dialog.saving.generate_lab_file.label") }}
                </div>
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
                    v-html="t('setting_dialog.saving.generate_lab_file.tip')"
                  />
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>
                  {{ t("setting_dialog.saving.generate_text_file.label") }}
                </div>
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
                    v-html="t('setting_dialog.saving.generate_text_file.tip')"
                  />
                </q-toggle>
              </q-card-actions>
            </q-card>
            <!-- Advanced Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">
                  {{ t("setting_dialog.advanced.title") }}
                </div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>
                  {{ t("setting_dialog.advanced.stereo.label") }}
                </div>
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
                    v-html="t('setting_dialog.advanced.stereo.tip')"
                  />
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>
                  {{ t("setting_dialog.advanced.device.label") }}
                </div>
                <q-space />
                <q-select
                  dense
                  v-model="currentAudioOutputDeviceComputed"
                  :label="t('setting_dialog.advanced.device.select_label')"
                  :options="availableAudioOutputDevices"
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                    v-html="t('setting_dialog.advanced.device.tip')"
                  />
                </q-select>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-setting-item">
                <div>
                  {{ t("setting_dialog.advanced.sample_rate.label") }}
                </div>
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
                  :input-style="{
                    width: `${
                      savingSetting.outputSamplingRate.length / 2 + 1
                    }em`,
                    minWidth: '150px',
                    maxWidth: '450px',
                  }"
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
                    v-html="t('setting_dialog.advanced.sample_rate.tip')"
                  />
                </q-select>
              </q-card-actions>
            </q-card>
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">
                  {{ t("setting_dialog.locale.title") }}
                </div>
                <q-space />
                <q-btn
                  v-if="
                    localeComputed != oldLocale ||
                    fallbackLocaleComputed != oldFallbackLocale
                  "
                  :label="t('setting_dialog.locale.relaunch.label')"
                  @click="relaunchRenderer()"
                  unelevated
                  no-caps
                  padding="none sm"
                  color="warning"
                  text-color="background"
                >
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                    v-html="t('setting_dialog.locale.relaunch.tip')"
                  />
                </q-btn>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-setting-item">
                <div>{{ t("setting_dialog.locale.language.label") }}</div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  v-model="localeComputed"
                  color="white"
                  text-color="black"
                  toggle-color="primary"
                  toggle-text-color="display"
                  :options="localeOption"
                >
                  <q-tooltip
                    v-if="localeComputed == oldLocale"
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                    v-html="t('setting_dialog.locale.language.tip')"
                  />
                </q-btn-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-setting-item">
                <div>{{ t("setting_dialog.locale.fallback.label") }}</div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  v-model="fallbackLocaleComputed"
                  color="white"
                  text-color="black"
                  toggle-color="primary"
                  toggle-text-color="display"
                  :options="localeOption"
                >
                  <q-tooltip
                    v-if="fallbackLocaleComputed == oldFallbackLocale"
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                    v-html="t('setting_dialog.locale.fallback.tip')"
                  />
                </q-btn-toggle>
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
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, onMounted } from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import { SavingSetting } from "@/type/preload";
import messages, { AvailableLocale, MessageSchema } from "@/i18n";
import { useI18n } from "vue-i18n";

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

    const changeUseGPU = async (useGpu: boolean) => {
      if (store.state.useGpu === useGpu) return;

      const change = async () => {
        await store.dispatch("SET_USE_GPU", { useGpu });
        store.dispatch("RESTART_ENGINE");

        $q.dialog({
          title: t("dialogs.change_engine_mode.title"),
          message: t("dialogs.change_engine_mode.msg"),
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
              message: t("dialogs.changing_engine_mode.msg"),
            });
            resolve(await window.electron.isAvailableGPUMode());
            $q.loading.hide();
          },
        });
      });

      if (useGpu && !isAvailableGPUMode) {
        $q.dialog({
          title: t("dialogs.gpu_not_found.title"),
          message: t("dialogs.gpu_not_found.msg"),
          html: true,
          persistent: true,
          focus: "cancel",
          style: {
            width: "90vw",
            maxWidth: "90vw",
          },
          ok: {
            label: t("dialogs.gpu_not_found.confirm"),
            flat: true,
            textColor: "display",
          },
          cancel: {
            label: t("dialogs.gpu_not_found.close"),
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
          title: t("dialogs.sample_rate.title"),
          message: t("dialogs.sample_rate.msg"),
          html: true,
          persistent: true,
          ok: {
            label: t("dialogs.sample_rate.confirm"),
            flat: true,
            textColor: "display",
          },
          cancel: {
            label: t("dialogs.sample_rate.close"),
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
        title: t("windows.choose_export_folder"),
      });
      if (path) {
        store.dispatch("SET_SAVING_SETTING", {
          data: { ...savingSetting.value, fixedExportDir: path },
        });
      }
    };

    const localeComputed = computed({
      get: () => store.state.i18nSetting.locale,
      set: (value: AvailableLocale) => {
        store.dispatch("SET_I18N_SETTING", {
          i18nSetting: {
            locale: value,
            fallbackLocale: fallbackLocaleComputed.value,
          },
        });
      },
    });

    const fallbackLocaleComputed = computed({
      get: () => store.state.i18nSetting.fallbackLocale,
      set: (value: AvailableLocale) => {
        store.dispatch("SET_I18N_SETTING", {
          i18nSetting: {
            locale: localeComputed.value,
            fallbackLocale: value,
          },
        });
      },
    });

    const { t } = useI18n<{ message: MessageSchema }>({
      useScope: "global",
    });

    const localeOption = [];

    for (const [key, value] of Object.entries(messages)) {
      localeOption.push({ label: value.loc_name, value: value.ISO_name });
    }

    document.addEventListener("keydown", (evt: KeyboardEvent) => {
      if (evt.key == "l") {
        console.log(localeComputed.value);
        console.log(fallbackLocaleComputed.value);
      }
    });

    const relaunchRenderer = () => {
      if (store.getters.IS_EDITED) {
        $q.dialog({
          html: true,
          title: t("windows.warning_project_overwrite.title"),
          message: t("windows.warning_project_overwrite.dialog_msg"),
          ok: {
            flat: true,
            textColor: "display",
          },
        }).onOk(() => location.reload());
      } else {
        location.reload();
      }
    };

    const oldLocale = ref("");
    const oldFallbackLocale = ref("");

    onMounted(() => {
      oldLocale.value = store.state.i18nSetting.locale;
      oldFallbackLocale.value = store.state.i18nSetting.fallbackLocale;
    });

    return {
      settingDialogOpenedComputed,
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
      localeOption,
      localeComputed,
      fallbackLocaleComputed,
      t,
      oldLocale,
      oldFallbackLocale,
      relaunchRenderer,
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
