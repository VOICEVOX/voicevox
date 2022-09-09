<template>
  <q-dialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog transparent-backdrop"
    v-model="settingDialogOpenedComputed"
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
        <q-page ref="scroller" class="scroller">
          <div class="q-pa-md row items-start q-gutter-md">
            <!-- Engine Mode Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">エンジン</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>エンジンモード</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      GPU モードの利用には GPU が必要です。Linux は
                      NVIDIA&trade; 製 GPU のみ対応しています。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  v-model="engineMode"
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="[
                    { label: 'CPU', value: 'switchCPU' },
                    { label: 'GPU', value: 'switchGPU' },
                  ]"
                >
                </q-btn-toggle>
              </q-card-actions>
            </q-card>
            <!-- Preservation Setting -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">操作</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>パラメータの引き継ぎ</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      テキスト欄を追加する際、現在の話速等のパラメータを引き継ぎます
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="inheritAudioInfoMode"
                  @update:model-value="changeinheritAudioInfo($event)"
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>再生位置を追従</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      再生位置を追従し、自動でスクロールするモードを選ぶことができます
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <div class="scroll-mode-toggle">
                  <q-radio
                    v-for="(obj, key) in activePointScrollModeOptions"
                    :key="key"
                    v-model="activePointScrollMode"
                    :val="key"
                    :label="obj.label"
                    size="0"
                    :class="[
                      'q-px-md',
                      'q-py-sm',
                      key !== activePointScrollMode && 'scroll-mode-button',
                      key === activePointScrollMode &&
                        'scroll-mode-button-selected',
                    ]"
                    :style="[
                      key === 'CONTINUOUSLY' && 'border-radius: 3px 0 0 3px',
                      key === 'OFF' && 'border-radius: 0 3px 3px 0',
                    ]"
                  >
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      再生位置を追従し、自動でスクロールします。
                      {{ `「${obj.label}」モードは${obj.desc}` }}
                    </q-tooltip>
                  </q-radio>
                </div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>テキスト分割の挙動</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      テキストを貼り付け時に行われる分割の挙動を変えます
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  :model-value="splitTextWhenPaste"
                  @update:model-value="changeSplitTextWhenPaste($event)"
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="[
                    {
                      label: '句点と改行',
                      value: 'PERIOD_AND_NEW_LINE',
                      slot: 'splitTextPeriodAndNewLine',
                    },
                    {
                      label: '改行',
                      value: 'NEW_LINE',
                      slot: 'splitTextNewLine',
                    },
                    { label: 'オフ', value: 'OFF', slot: 'splitTextOFF' },
                  ]"
                >
                  <template v-slot:splitTextPeriodAndNewLine>
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      句点と改行を基にテキストを分割します。
                    </q-tooltip>
                  </template>
                  <template v-slot:splitTextNewLine>
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      改行のみを基にテキストを分割します。
                    </q-tooltip>
                  </template>
                  <template v-slot:splitTextOFF>
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      分割を行いません。
                    </q-tooltip>
                  </template>
                </q-btn-toggle>
              </q-card-actions>
            </q-card>
            <!-- Saving Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">保存</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>文字コード</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      文字コードを選ぶことができます
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  :model-value="savingSetting.fileEncoding"
                  @update:model-value="
                    handleSavingSettingChange('fileEncoding', $event)
                  "
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="[
                    { label: 'UTF-8', value: 'UTF-8' },
                    { label: 'Shift_JIS', value: 'Shift_JIS' },
                  ]"
                />
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>書き出し先を固定</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      音声ファイルを設定したフォルダに書き出す
                    </q-tooltip>
                  </q-icon>
                </div>
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
                  :model-value="savingSetting.fixedExportEnabled"
                  @update:model-value="
                    handleSavingSettingChange('fixedExportEnabled', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>

              <file-name-pattern-dialog
                v-model:open-dialog="showsFilePatternEditDialog"
              />

              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>書き出しファイル名パターン</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      書き出すファイル名のパターンをカスタマイズする
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <div class="q-px-sm text-ellipsis">
                  {{ savingSetting.fileNamePattern }}
                </div>
                <q-btn
                  label="編集"
                  unelevated
                  color="background"
                  text-color="display"
                  class="text-no-wrap q-mr-sm"
                  @click="showsFilePatternEditDialog = true"
                />
              </q-card-actions>

              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>上書き防止</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      上書きせずにファイルを連番で保存します
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.avoidOverwrite"
                  @update:model-value="
                    handleSavingSettingChange('avoidOverwrite', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>txtファイルを書き出し</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      テキストをtxtファイルとして書き出します
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.exportText"
                  color="primary"
                  @update:model-value="
                    handleSavingSettingChange('exportText', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>labファイルを書き出し</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      リップシンク用のlabファイルを書き出します
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.exportLab"
                  @update:model-value="
                    handleSavingSettingChange('exportLab', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
            </q-card>
            <!-- Experimental Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">高度な設定</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>音声をステレオ化</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      音声データをモノラルからステレオに変換してから再生・保存を行います
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.outputStereo"
                  @update:model-value="
                    handleSavingSettingChange('outputStereo', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>再生デバイス</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      音声の再生デバイスを変更し再生を行います
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-select
                  dense
                  v-model="currentAudioOutputDeviceComputed"
                  label="再生デバイス"
                  :options="availableAudioOutputDevices"
                  class="col-7"
                >
                </q-select>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>音声のサンプリングレート</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      再生・保存時の音声のサンプリングレートを変更します（サンプリングレートを上げても音声の品質は上がりません。）
                    </q-tooltip>
                  </q-icon>
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
                  @update:model-value="
                    handleSavingSettingChange('outputSamplingRate', $event)
                  "
                >
                </q-select>
              </q-card-actions>
            </q-card>
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">実験的機能</div>
              </q-card-actions>
              <!-- 今後実験的機能を追加する場合はここに追加 -->
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>テーマ</div>
                <q-icon name="help_outline" size="sm" class="help-hover-icon">
                  <q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                  >
                    エディタの外観を変更します
                  </q-tooltip>
                </q-icon>
                <q-space />
                <q-btn-toggle
                  unelevated
                  padding="xs md"
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  v-model="currentThemeNameComputed"
                  :options="availableThemeNameComputed"
                />
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>プリセット機能</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      プリセット機能を有効にする
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="experimentalSetting.enablePreset"
                  @update:model-value="
                    changeExperimentalSetting('enablePreset', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>疑問文を自動調整</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      疑問文のとき語尾の音高を自動的に上げる
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="experimentalSetting.enableInterrogativeUpspeak"
                  @update:model-value="
                    changeExperimentalSetting(
                      'enableInterrogativeUpspeak',
                      $event
                    )
                  "
                >
                </q-toggle>
              </q-card-actions>
            </q-card>
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">データ収集</div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>ソフトウェア利用状況のデータ収集を許可する</div>
                <div>
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center left"
                      self="center right"
                      transition-show="jump-left"
                      transition-hide="jump-right"
                    >
                      各UIの利用率などのデータを送信してVOICEVOXの改善に役立てます。テキストデータ・音声データは送信しません。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle v-model="acceptRetrieveTelemetryComputed" />
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
import { useQuasar } from "quasar";
import {
  SavingSetting,
  ExperimentalSetting,
  ActivePointScrollMode,
  SplitTextWhenPasteType,
} from "@/type/preload";
import FileNamePatternDialog from "./FileNamePatternDialog.vue";

export default defineComponent({
  name: "SettingDialog",

  components: {
    FileNamePatternDialog,
  },

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
    const activePointScrollMode = computed({
      get: () => store.state.activePointScrollMode,
      set: (activePointScrollMode: ActivePointScrollMode) => {
        store.dispatch("SET_ACTIVE_POINT_SCROLL_MODE", {
          activePointScrollMode,
        });
      },
    });
    const activePointScrollModeOptions: Record<
      ActivePointScrollMode,
      {
        label: string;
        desc: string;
      }
    > = {
      CONTINUOUSLY: {
        label: "連続",
        desc: "再生位置を真ん中に表示します。",
      },
      PAGE: {
        label: "ページめくり",
        desc: "再生位置が表示範囲外にある場合にスクロールします。",
      },
      OFF: {
        label: "オフ",
        desc: "自動でスクロールしません。",
      },
    };

    const experimentalSetting = computed(() => store.state.experimentalSetting);

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
      return [...store.state.themeSetting.availableThemes]
        .sort((a, b) => a.order - b.order)
        .map((theme) => {
          return { label: theme.displayName, value: theme.name };
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

    const acceptRetrieveTelemetryComputed = computed({
      get: () => store.state.acceptRetrieveTelemetry == "Accepted",
      set: (acceptRetrieveTelemetry: boolean) => {
        store.dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
          acceptRetrieveTelemetry: acceptRetrieveTelemetry
            ? "Accepted"
            : "Refused",
        });

        if (acceptRetrieveTelemetry) {
          return;
        }

        $q.dialog({
          title: "ソフトウェア利用状況のデータ収集の無効化",
          message:
            "ソフトウェア利用状況のデータ収集を完全に無効にするには、VOICEVOXを再起動する必要があります",
          ok: {
            flat: true,
            textColor: "display",
          },
        });
      },
    });

    const changeUseGPU = async (useGpu: boolean) => {
      if (store.state.useGpu === useGpu) return;

      $q.loading.show({
        spinnerColor: "primary",
        spinnerSize: 50,
        boxClass: "bg-background text-display",
        message: "起動モードを変更中です",
      });

      await store.dispatch("CHANGE_USE_GPU", { useGpu });

      $q.loading.hide();
    };

    const changeinheritAudioInfo = async (inheritAudioInfo: boolean) => {
      if (store.state.inheritAudioInfo === inheritAudioInfo) return;
      store.dispatch("SET_INHERIT_AUDIOINFO", { inheritAudioInfo });
    };

    const changeExperimentalSetting = async (
      key: keyof ExperimentalSetting,
      data: boolean
    ) => {
      store.dispatch("SET_EXPERIMENTAL_SETTING", {
        experimentalSetting: { ...experimentalSetting.value, [key]: data },
      });
    };

    const restartAllEngineProcess = () => {
      store.dispatch("RESTART_ENGINE_ALL");
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
            "出力サンプリングレートを変更しても、音質は変化しません。また、音声の生成処理に若干時間がかかる場合があります。<br />変更しますか？",
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

    const splitTextWhenPaste = computed(() => store.state.splitTextWhenPaste);
    const changeSplitTextWhenPaste = (
      splitTextWhenPaste: SplitTextWhenPasteType
    ) => {
      store.dispatch("SET_SPLIT_TEXT_WHEN_PASTE", { splitTextWhenPaste });
    };

    const showsFilePatternEditDialog = ref(false);

    return {
      settingDialogOpenedComputed,
      engineMode,
      inheritAudioInfoMode,
      activePointScrollMode,
      activePointScrollModeOptions,
      experimentalSetting,
      currentAudioOutputDeviceComputed,
      availableAudioOutputDevices,
      changeinheritAudioInfo,
      changeExperimentalSetting,
      restartAllEngineProcess,
      savingSetting,
      handleSavingSettingChange,
      openFileExplore,
      currentThemeNameComputed,
      currentThemeComputed,
      availableThemeNameComputed,
      acceptRetrieveTelemetryComputed,
      splitTextWhenPaste,
      changeSplitTextWhenPaste,
      showsFilePatternEditDialog,
    };
  },
});
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.setting-dialog {
  .q-field__control {
    color: colors.$primary;
  }
}

.help-hover-icon {
  margin-left: 6px;
  color: colors.$display;
  opacity: 0.5;
}

.hotkey-table {
  width: 100%;
}

.setting-card {
  @extend .hotkey-table;
  min-width: 475px;
  background: colors.$background;
}

.scroll-mode-toggle {
  background: colors.$background;
  border-radius: 3px;
}

.scroll-mode-button {
  background: colors.$background;
  color: colors.$display;
  transition: 0.5s;
}

.scroll-mode-button-selected {
  background: colors.$primary;
  color: colors.$display-on-primary;
}

.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scroll-mode-button:hover {
  background: rgba(colors.$primary-rgb, 0.2);
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
