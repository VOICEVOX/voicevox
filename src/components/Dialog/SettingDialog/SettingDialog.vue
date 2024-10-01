<template>
  <QDialog
    v-model="settingDialogOpenedComputed"
    maximized
    allowFocusOutside
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer class="root">
        <QHeader class="q-pa-sm">
          <QToolbar>
            <QToolbarTitle class="text-display"
              >設定 / オプション</QToolbarTitle
            >
            <QSpace />
            <!-- close button -->
            <QBtn
              round
              flat
              icon="close"
              color="display"
              aria-label="設定を閉じる"
              @click="settingDialogOpenedComputed = false"
            />
          </QToolbar>
        </QHeader>
        <QPage>
          <div class="container">
            <BaseScrollArea>
              <!-- Engine Mode Card -->
              <div class="setting-card">
                <div class="title-row">
                  <h5 class="headline">エンジン</h5>
                  <template v-if="engineIds.length > 1">
                    <BaseSelect v-model="selectedEngineId">
                      <BaseSelectItem
                        v-for="engineId in engineIds"
                        :key="engineId"
                        :value="engineId"
                        :label="renderEngineNameLabel(engineId)"
                      />
                    </BaseSelect>
                  </template>
                </div>
                <ButtonToggleCell
                  title="エンジンモード"
                  description="GPU モードの利用には GPU が必要です。Linux は NVIDIA™ 製 GPU のみ対応しています。"
                  :options="engineUseGpuOptions"
                  :disable="!gpuSwitchEnabled(selectedEngineId)"
                  :modelValue="engineUseGpu ? 'GPU' : 'CPU'"
                  @update:modelValue="(mode) => (engineUseGpu = mode === 'GPU')"
                >
                  <QTooltip
                    :delay="500"
                    :target="!gpuSwitchEnabled(selectedEngineId)"
                  >
                    {{
                      engineInfos[selectedEngineId].name
                    }}はCPU版のためGPUモードを利用できません。
                  </QTooltip>
                </ButtonToggleCell>
                <BaseRowCard
                  title="音声のサンプリングレート"
                  description="再生・保存時の音声のサンプリングレートを変更できます（サンプリングレートを上げても音声の品質は上がりません）。"
                >
                  <BaseSelect
                    :modelValue="outputSamplingRate.toString()"
                    @update:modelValue="
                      (value) =>
                        (outputSamplingRate = value as number | 'engineDefault')
                    "
                  >
                    <BaseSelectItem
                      v-for="samplingRateOption in samplingRateOptions"
                      :key="samplingRateOption"
                      :value="samplingRateOption.toString()"
                      :label="renderSamplingRateLabel(samplingRateOption)"
                    />
                  </BaseSelect>
                </BaseRowCard>
              </div>
              <!-- Preservation Setting -->
              <div class="setting-card">
                <h5 class="headline">操作</h5>
                <ToggleCell
                  title="プリセット機能"
                  description="ONの場合、プリセット機能を有効にします。パラメータを登録したり適用したりできます。"
                  :modelValue="enablePreset"
                  @update:modelValue="changeEnablePreset"
                />
                <QSlideTransition>
                  <!-- q-slide-transitionはheightだけをアニメーションするのでdivで囲う -->
                  <div v-show="enablePreset" class="transition-container">
                    <ToggleCell
                      title="スタイル変更時にデフォルトプリセットを適用"
                      description="ONの場合、キャラやスタイルの変更時にデフォルトプリセットが自動的に適用されます。"
                      class="in-slide-transition-workaround"
                      :modelValue="shouldApplyDefaultPresetOnVoiceChanged"
                      @update:modelValue="
                        changeShouldApplyDefaultPresetOnVoiceChanged($event)
                      "
                    />
                  </div>
                </QSlideTransition>
                <ToggleCell
                  title="パラメータの引き継ぎ"
                  description="ONの場合、テキスト欄追加の際に、現在の話速等のパラメータが引き継がれます。"
                  :modelValue="inheritAudioInfoMode"
                  @update:modelValue="changeinheritAudioInfo"
                />
                <ButtonToggleCell
                  v-model="activePointScrollMode"
                  title="再生位置を追従"
                  description="音声再生中の、詳細調整欄の自動スクロールのモードを選べます。"
                  :options="[
                    {
                      label: '連続',
                      value: 'CONTINUOUSLY',
                      description: '現在の再生位置を真ん中に表示します。',
                    },
                    {
                      label: 'ページめくり',
                      value: 'PAGE',
                      description:
                        '現在の再生位置が表示範囲外にある場合にスクロールします。',
                    },
                    {
                      label: 'オフ',
                      value: 'OFF',
                      description: '自動でスクロールしません。',
                    },
                  ]"
                />
                <ButtonToggleCell
                  title="テキスト自動分割"
                  description="テキスト貼り付けの際のテキストの分割箇所を選べます。"
                  :modelValue="splitTextWhenPaste"
                  :options="[
                    {
                      label: '句点と改行',
                      value: 'PERIOD_AND_NEW_LINE',
                      description: '句点と改行を基にテキストを分割します。',
                    },
                    {
                      label: '改行',
                      value: 'NEW_LINE',
                      description: '改行のみを基にテキストを分割します。',
                    },
                    {
                      label: 'オフ',
                      value: 'OFF',
                      description: '分割を行いません。',
                    },
                  ]"
                  @update:modelValue="
                    changeSplitTextWhenPaste(
                      $event as RootMiscSettingType['splitTextWhenPaste'],
                    )
                  "
                />
                <ToggleCell
                  title="メモ機能"
                  description="ONの場合、テキストを [] で囲むことで、テキスト中にメモを書けます。"
                  :modelValue="enableMemoNotation"
                  @update:modelValue="changeEnableMemoNotation"
                />
                <ToggleCell
                  title="ルビ機能"
                  description="ONの場合、テキストに {ルビ対象|よみかた} と書くことで、テキストの読み方を変えられます。"
                  :modelValue="enableRubyNotation"
                  @update:modelValue="changeEnableRubyNotation"
                />
                <BaseRowCard
                  title="非表示にしたヒントを全て再表示"
                  description="過去に非表示にしたヒントを全て再表示できます。"
                >
                  <BaseButton
                    label="再表示する"
                    :disabled="isDefaultConfirmedTips"
                    @click="
                      () => {
                        store.dispatch('RESET_CONFIRMED_TIPS');
                        hasResetConfirmedTips = true;
                      }
                    "
                  />
                </BaseRowCard>
              </div>
              <!-- Saving Card -->
              <div class="setting-card">
                <h5 class="headline">保存</h5>
                <ToggleCell
                  title="書き出し先を固定"
                  description="ONの場合、書き出す際のフォルダをあらかじめ指定できます。"
                  :modelValue="savingSetting.fixedExportEnabled"
                  @update:modelValue="
                    handleSavingSettingChange('fixedExportEnabled', $event)
                  "
                >
                </ToggleCell>
                <QSlideTransition>
                  <!-- q-slide-transitionはheightだけをアニメーションするのでdivで囲う -->
                  <div
                    v-show="savingSetting.fixedExportEnabled"
                    class="transition-container"
                  >
                    <BaseRowCard title="書き出し先のフォルダ">
                      {{ savingSetting.fixedExportDir }}
                      <BaseButton
                        icon="folder_open"
                        label="フォルダ選択"
                        @click="selectFixedExportDir()"
                      >
                      </BaseButton>
                    </BaseRowCard>
                  </div>
                </QSlideTransition>

                <FileNameTemplateDialog
                  v-model:open-dialog="showAudioFilePatternEditDialog"
                  :savedTemplate="audioFileNamePattern"
                  :defaultTemplate="DEFAULT_AUDIO_FILE_BASE_NAME_TEMPLATE"
                  :availableTags="[
                    'index',
                    'characterName',
                    'styleName',
                    'text',
                    'date',
                    'projectName',
                  ]"
                  :fileNameBuilder="buildAudioFileNameFromRawData"
                  @update:template="
                    handleSavingSettingChange('fileNamePattern', $event)
                  "
                />
                <FileNameTemplateDialog
                  v-model:open-dialog="showSongTrackAudioFilePatternEditDialog"
                  :savedTemplate="songTrackFileNamePattern"
                  :defaultTemplate="DEFAULT_SONG_AUDIO_FILE_BASE_NAME_TEMPLATE"
                  :availableTags="[
                    'index',
                    'characterName',
                    'styleName',
                    'trackName',
                    'date',
                    'projectName',
                  ]"
                  :fileNameBuilder="buildSongTrackAudioFileNameFromRawData"
                  @update:template="
                    handleSavingSettingChange(
                      'songTrackFileNamePattern',
                      $event,
                    )
                  "
                />

                <EditButtonCell
                  title="書き出しファイル名パターン"
                  description="書き出す際のファイル名のパターンをカスタマイズできます。"
                  :currentValue="savingSetting.fileNamePattern"
                  @buttonClick="showAudioFilePatternEditDialog = true"
                />

                <ToggleCell
                  title="上書き防止"
                  description="ONの場合、書き出す際に同名ファイルが既にあったとき、ファイル名に連番を付けて別名で保存されます。"
                  :modelValue="savingSetting.avoidOverwrite"
                  @update:modelValue="
                    handleSavingSettingChange('avoidOverwrite', $event)
                  "
                />
                <ButtonToggleCell
                  title="文字コード"
                  description="テキストファイルを書き出す際の文字コードを選べます。"
                  :modelValue="savingSetting.fileEncoding"
                  :options="[
                    { label: 'UTF-8', value: 'UTF-8' },
                    { label: 'Shift_JIS', value: 'Shift_JIS' },
                  ]"
                  @update:modelValue="
                    handleSavingSettingChange('fileEncoding', $event as string)
                  "
                />
                <ToggleCell
                  title="txtファイルを書き出し"
                  description="ONの場合、音声書き出しの際にテキストがtxtファイルとして書き出されます。"
                  :modelValue="savingSetting.exportText"
                  @update:modelValue="
                    handleSavingSettingChange('exportText', $event)
                  "
                />
                <ToggleCell
                  title="labファイルを書き出し"
                  description="ONの場合、音声書き出しの際にリップシンク用のlabファイルが書き出されます。"
                  :modelValue="savingSetting.exportLab"
                  @update:modelValue="
                    handleSavingSettingChange('exportLab', $event)
                  "
                />

                <QSlideTransition>
                  <!-- q-slide-transitionはheightだけをアニメーションするのでdivで囲う -->
                  <div
                    v-show="experimentalSetting.enableMultiTrack"
                    class="transition-container"
                  >
                    <EditButtonCell
                      title="ソング：トラックファイル名パターン"
                      description="書き出す際のファイル名のパターンをカスタマイズできます。"
                      :currentValue="savingSetting.songTrackFileNamePattern"
                      @buttonClick="
                        showSongTrackAudioFilePatternEditDialog = true
                      "
                    />
                  </div>
                </QSlideTransition>
              </div>
              <!-- Theme Card -->
              <div class="setting-card">
                <h5 class="headline">外観</h5>
                <ButtonToggleCell
                  v-model="currentThemeNameComputed"
                  title="テーマ"
                  description="エディタの色を選べます。"
                  :options="availableThemeNameComputed"
                />
                <ButtonToggleCell
                  title="フォント"
                  description="エディタのフォントを選べます。"
                  :modelValue="editorFont"
                  :options="[
                    { label: 'デフォルト', value: 'default' },
                    { label: 'OS標準', value: 'os' },
                  ]"
                  @update:modelValue="
                    changeEditorFont($event as EditorFontType)
                  "
                />
                <ToggleCell
                  title="行番号の表示"
                  description="ONの場合、テキスト欄の左側に行番号が表示されます。"
                  :modelValue="showTextLineNumber"
                  @update:modelValue="changeShowTextLineNumber"
                />
                <ToggleCell
                  title="テキスト追加ボタンの表示"
                  description="OFFの場合、右下にテキスト追加ボタンが表示されません。（テキスト欄は Shift + Enter で追加できます）"
                  :modelValue="showAddAudioItemButton"
                  @update:modelValue="changeShowAddAudioItemButton"
                />
              </div>

              <!-- Advanced Card -->
              <div class="setting-card">
                <h5 class="headline">高度な設定</h5>
                <ToggleCell
                  title="マルチエンジン機能"
                  description="ONの場合、複数のVOICEVOX準拠エンジンを利用可能にします。"
                  :modelValue="enableMultiEngine"
                  @update:modelValue="setEnableMultiEngine"
                />
                <ToggleCell
                  title="音声をステレオ化"
                  description="ONの場合、音声データがモノラルからステレオに変換されてから再生・保存が行われます。"
                  :modelValue="savingSetting.outputStereo"
                  @update:modelValue="
                    handleSavingSettingChange('outputStereo', $event)
                  "
                />
                <BaseRowCard
                  title="再生デバイス"
                  description="音声の再生デバイスを変更できます。"
                >
                  <template v-if="!canSetAudioOutputDevice">
                    この機能はお使いの環境でサポートされていないため、使用できません。
                  </template>
                  <BaseSelect
                    v-model="currentAudioOutputDeviceComputed"
                    :disabled="!canSetAudioOutputDevice"
                  >
                    <BaseSelectItem
                      v-for="availableAudioOutputDevice in availableAudioOutputDevices"
                      :key="availableAudioOutputDevice.key"
                      :value="availableAudioOutputDevice.key"
                      :label="availableAudioOutputDevice.label"
                    />
                  </BaseSelect>
                </BaseRowCard>
                <QSlideTransition>
                  <!-- q-slide-transitionはheightだけをアニメーションするのでdivで囲う -->
                  <div
                    v-show="experimentalSetting.enableMultiTrack"
                    class="transition-container"
                  >
                    <BaseRowCard
                      title="ソング：元に戻すトラック操作"
                      description="「元に戻す」機能の対象とするトラック操作を指定します。"
                    >
                      <BaseCheckbox
                        v-for="(value, key) in undoableTrackOperations"
                        :key
                        :checked="value"
                        :label="undoableTrackOperationsLabels[key]"
                        @update:checked="
                          (newValue) =>
                            (undoableTrackOperations = {
                              ...undoableTrackOperations,
                              [key]: newValue,
                            })
                        "
                      />
                    </BaseRowCard>
                  </div>
                </QSlideTransition>
              </div>

              <!-- Experimental Card -->
              <div class="setting-card">
                <h5 class="headline">実験的機能</h5>
                <!-- 今後実験的機能を追加する場合はここに追加 -->
                <ToggleCell
                  title="疑問文を自動調整"
                  description="ONの場合、疑問文の語尾の音高が自動的に上げられます。"
                  :modelValue="experimentalSetting.enableInterrogativeUpspeak"
                  @update:modelValue="
                    changeExperimentalSetting(
                      'enableInterrogativeUpspeak',
                      $event,
                    )
                  "
                />
                <ToggleCell
                  title="モーフィング機能"
                  description="ONの場合、モーフィング機能を有効にします。2つの音声混ぜられるようになります。"
                  :modelValue="experimentalSetting.enableMorphing"
                  @update:modelValue="
                    changeExperimentalSetting('enableMorphing', $event)
                  "
                />
                <ToggleCell
                  title="複数選択"
                  description="ONの場合、複数のテキスト欄を選択できるようにします。"
                  :modelValue="experimentalSetting.enableMultiSelect"
                  @update:modelValue="
                    changeExperimentalSetting('enableMultiSelect', $event)
                  "
                />
                <ToggleCell
                  v-if="!isProduction"
                  title="[開発時のみ機能] 調整結果の保持"
                  description="ONの場合、テキスト変更時、同じ読みのアクセント区間内の調整結果を保持します。"
                  :modelValue="experimentalSetting.shouldKeepTuningOnTextChange"
                  @update:modelValue="
                    changeExperimentalSetting(
                      'shouldKeepTuningOnTextChange',
                      $event,
                    )
                  "
                />
                <ToggleCell
                  title="ソング：マルチトラック機能"
                  description="ONの場合、１つのプロジェクト内に複数のトラックを作成できるようにします。"
                  :modelValue="experimentalSetting.enableMultiTrack"
                  :disable="!canToggleMultiTrack"
                  @update:modelValue="setMultiTrack($event)"
                >
                  <QTooltip v-if="!canToggleMultiTrack" :delay="500">
                    現在のプロジェクトに複数のトラックが存在するため、無効化できません。
                  </QTooltip>
                </ToggleCell>
              </div>
              <div class="setting-card">
                <h5 class="headline">データ収集</h5>
                <ToggleCell
                  title="ソフトウェア利用状況のデータ収集を許可"
                  description="ONの場合、各UIの利用率などのデータが送信され、VOICEVOXの改善に役立てられます。テキストデータや音声データは送信されません。"
                  :modelValue="acceptRetrieveTelemetryComputed"
                  @update:modelValue="acceptRetrieveTelemetryComputed = $event"
                />
              </div>
            </BaseScrollArea>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import FileNameTemplateDialog from "./FileNameTemplateDialog.vue";
import ToggleCell from "./ToggleCell.vue";
import ButtonToggleCell from "./ButtonToggleCell.vue";
import EditButtonCell from "./EditButtonCell.vue";
import BaseRowCard from "@/components/Base/BaseRowCard.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import BaseSelect from "@/components/Base/BaseSelect.vue";
import BaseSelectItem from "@/components/Base/BaseSelectItem.vue";
import BaseCheckbox from "@/components/Base/BaseCheckbox.vue";
import { useStore } from "@/store";
import {
  DEFAULT_AUDIO_FILE_BASE_NAME_TEMPLATE,
  DEFAULT_SONG_AUDIO_FILE_BASE_NAME_TEMPLATE,
  buildAudioFileNameFromRawData,
  buildSongTrackAudioFileNameFromRawData,
} from "@/store/utility";
import {
  isProduction,
  SavingSetting,
  EngineSettingType,
  ExperimentalSettingType,
  ActivePointScrollMode,
  RootMiscSettingType,
  EngineId,
  EditorFontType,
} from "@/type/preload";
import { createLogger } from "@/domain/frontend/log";

type SamplingRateOption = EngineSettingType["outputSamplingRate"];

// ルート直下にある雑多な設定値を簡単に扱えるようにする
const useRootMiscSetting = <T extends keyof RootMiscSettingType>(key: T) => {
  const state = computed(() => store.state[key]);
  const setter = (value: RootMiscSettingType[T]) => {
    // Vuexの型処理でUnionが解かれてしまうのを迂回している
    // FIXME: このワークアラウンドをなくす
    void store.dispatch("SET_ROOT_MISC_SETTING", { key: key as never, value });
  };
  return [state, setter] as const;
};

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const store = useStore();
const { warn } = createLogger("SettingDialog");

const settingDialogOpenedComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const engineUseGpu = computed({
  get: () => {
    return store.state.engineSettings[selectedEngineId.value].useGpu;
  },
  set: (mode: boolean) => {
    void changeUseGpu(mode);
  },
});
const engineIds = computed(() => store.state.engineIds);
const engineInfos = computed(() => store.state.engineInfos);
const inheritAudioInfoMode = computed(() => store.state.inheritAudioInfo);
const activePointScrollMode = computed({
  get: () => store.state.activePointScrollMode,
  set: (activePointScrollMode: ActivePointScrollMode) => {
    void store.dispatch("SET_ACTIVE_POINT_SCROLL_MODE", {
      activePointScrollMode,
    });
  },
});
const experimentalSetting = computed(() => store.state.experimentalSetting);

// 非表示にしたヒントの再表示
const hasResetConfirmedTips = ref(false);
const isDefaultConfirmedTips = computed(() => {
  const confirmedTips = store.state.confirmedTips;
  // すべて false (= 初期値) かどうか確認
  return Object.values(confirmedTips).every((v) => !v);
});

// ソング：元に戻すトラック操作
const undoableTrackOperationsLabels = {
  soloAndMute: "ミュート・ソロ",
  panAndGain: "パン・音量",
};
const undoableTrackOperations = computed({
  get: () => store.state.undoableTrackOperations,
  set: (undoableTrackOperations) => {
    void store.dispatch("SET_ROOT_MISC_SETTING", {
      key: "undoableTrackOperations",
      value: undoableTrackOperations,
    });
  },
});

// 外観
const currentThemeNameComputed = computed({
  get: () => store.state.themeSetting.currentTheme,
  set: (currentTheme: string) => {
    void store.dispatch("SET_THEME_SETTING", { currentTheme: currentTheme });
  },
});

const availableThemeNameComputed = computed(() => {
  return [...store.state.themeSetting.availableThemes]
    .sort((a, b) => a.order - b.order)
    .map((theme) => {
      return { label: theme.displayName, value: theme.name };
    });
});

const [editorFont, changeEditorFont] = useRootMiscSetting("editorFont");

const [enableMultiEngine, setEnableMultiEngine] =
  useRootMiscSetting("enableMultiEngine");

const [showTextLineNumber, changeShowTextLineNumber] =
  useRootMiscSetting("showTextLineNumber");

const [showAddAudioItemButton, changeShowAddAudioItemButton] =
  useRootMiscSetting("showAddAudioItemButton");

const [enableMemoNotation, changeEnableMemoNotation] =
  useRootMiscSetting("enableMemoNotation");

const [enableRubyNotation, changeEnableRubyNotation] =
  useRootMiscSetting("enableRubyNotation");

const [enablePreset, _changeEnablePreset] = useRootMiscSetting("enablePreset");

const [
  shouldApplyDefaultPresetOnVoiceChanged,
  changeShouldApplyDefaultPresetOnVoiceChanged,
] = useRootMiscSetting("shouldApplyDefaultPresetOnVoiceChanged");

const canSetAudioOutputDevice = computed(() => {
  return !!HTMLAudioElement.prototype.setSinkId;
});
const currentAudioOutputDeviceComputed = computed<string | undefined>({
  get: () => {
    // 再生デバイスが見つからなかったらデフォルト値に戻す
    // FIXME: watchなどにしてgetter内で操作しないようにする
    const device = availableAudioOutputDevices.value?.find(
      (device) => device.key === store.state.savingSetting.audioOutputDevice,
    );
    if (device) {
      return device.key;
    } else if (store.state.savingSetting.audioOutputDevice !== "default") {
      handleSavingSettingChange("audioOutputDevice", "default");
    }
    return undefined;
  },
  set: (device) => {
    if (device) {
      handleSavingSettingChange("audioOutputDevice", device);
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
if (navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener(
    "devicechange",
    updateAudioOutputDevices,
  );
  void updateAudioOutputDevices();
} else {
  warn("navigator.mediaDevices is not available.");
}

const acceptRetrieveTelemetryComputed = computed({
  get: () => store.state.acceptRetrieveTelemetry == "Accepted",
  set: (acceptRetrieveTelemetry: boolean) => {
    void store.dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
      acceptRetrieveTelemetry: acceptRetrieveTelemetry ? "Accepted" : "Refused",
    });

    if (acceptRetrieveTelemetry) {
      return;
    }

    void store.dispatch("SHOW_ALERT_DIALOG", {
      title: "ソフトウェア利用状況のデータ収集の無効化",
      message:
        "ソフトウェア利用状況のデータ収集を完全に無効にするには、VOICEVOXを再起動する必要があります",
      ok: "OK",
    });
  },
});

const changeUseGpu = async (useGpu: boolean) => {
  void store.dispatch("SHOW_LOADING_SCREEN", {
    message: "起動モードを変更中です",
  });

  await store.dispatch("CHANGE_USE_GPU", {
    useGpu,
    engineId: selectedEngineId.value,
  });

  void store.dispatch("HIDE_ALL_LOADING_SCREEN");
};

const changeinheritAudioInfo = async (inheritAudioInfo: boolean) => {
  if (store.state.inheritAudioInfo === inheritAudioInfo) return;
  void store.dispatch("SET_INHERIT_AUDIOINFO", { inheritAudioInfo });
};

const changeEnablePreset = (value: boolean) => {
  if (value) {
    // プリセット機能をONにしたときは「デフォルトプリセットを自動で適用」もONにする
    _changeEnablePreset(true);
    changeShouldApplyDefaultPresetOnVoiceChanged(true);
  } else {
    _changeEnablePreset(false);
    changeShouldApplyDefaultPresetOnVoiceChanged(false);
  }
};

const changeExperimentalSetting = async (
  key: keyof ExperimentalSettingType,
  data: boolean,
) => {
  void store.dispatch("SET_EXPERIMENTAL_SETTING", {
    experimentalSetting: { ...experimentalSetting.value, [key]: data },
  });
};

const savingSetting = computed(() => store.state.savingSetting);

const engineUseGpuOptions = [
  { label: "CPU", value: "CPU" },
  { label: "GPU", value: "GPU" },
];

const audioFileNamePattern = computed(
  () => store.state.savingSetting.fileNamePattern,
);
const songTrackFileNamePattern = computed(
  () => store.state.savingSetting.songTrackFileNamePattern,
);

const gpuSwitchEnabled = (engineId: EngineId) => {
  // CPU版でもGPUモードからCPUモードに変更できるようにする
  return store.getters.ENGINE_CAN_USE_GPU(engineId) || engineUseGpu.value;
};

const samplingRateOptions: SamplingRateOption[] = [
  "engineDefault",
  24000,
  44100,
  48000,
  88200,
  96000,
];
const renderSamplingRateLabel = (value: SamplingRateOption): string => {
  if (value === "engineDefault") {
    return "デフォルト";
  } else {
    return `${value / 1000} kHz`;
  }
};

const handleSavingSettingChange = (
  key: keyof SavingSetting,
  data: string | boolean | number,
) => {
  void store.dispatch("SET_SAVING_SETTING", {
    data: { ...savingSetting.value, [key]: data },
  });
};

const outputSamplingRate = computed({
  get: () => {
    return store.state.engineSettings[selectedEngineId.value]
      .outputSamplingRate;
  },
  set: async (outputSamplingRate: SamplingRateOption) => {
    if (outputSamplingRate !== "engineDefault") {
      const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
        title: "出力サンプリングレートを変更します",
        message:
          "出力サンプリングレートを変更しても、音質は変化しません。また、音声の生成処理に若干時間がかかる場合があります。<br />変更しますか？",
        html: true,
        actionName: "変更する",
        cancel: "変更しない",
      });
      if (result !== "OK") {
        return;
      }
    }

    void store.dispatch("SET_ENGINE_SETTING", {
      engineId: selectedEngineId.value,
      engineSetting: {
        ...store.state.engineSettings[selectedEngineId.value],
        outputSamplingRate,
      },
    });
  },
});

const openFileExplore = () => {
  return window.backend.showSaveDirectoryDialog({
    title: "書き出し先のフォルダを選択",
  });
};

const selectFixedExportDir = async () => {
  const path = await openFileExplore();
  if (path != undefined) {
    handleSavingSettingChange("fixedExportDir", path);
  }
};

// 書き出し先を固定を有効にしたときに書き出し先が未選択の場合は自動的にダイアログを表示する
watchEffect(async () => {
  if (
    savingSetting.value.fixedExportEnabled &&
    savingSetting.value.fixedExportDir === ""
  ) {
    const path = await openFileExplore();
    if (path != undefined) {
      handleSavingSettingChange("fixedExportDir", path);
    } else {
      // キャンセルした場合書き出し先の固定を無効化する
      handleSavingSettingChange("fixedExportEnabled", false);
    }
  }
});

const [splitTextWhenPaste, changeSplitTextWhenPaste] =
  useRootMiscSetting("splitTextWhenPaste");

const showAudioFilePatternEditDialog = ref(false);
const showSongTrackAudioFilePatternEditDialog = ref(false);

const selectedEngineIdRaw = ref<EngineId | undefined>(undefined);
const selectedEngineId = computed({
  get: () => {
    return selectedEngineIdRaw.value || engineIds.value[0];
  },
  set: (engineId: EngineId) => {
    selectedEngineIdRaw.value = engineId;
  },
});
const renderEngineNameLabel = (engineId: EngineId) => {
  return engineInfos.value[engineId].name;
};

// トラックが複数あるときはマルチトラック機能を無効化できないようにする
const canToggleMultiTrack = computed(() => {
  if (!experimentalSetting.value.enableMultiTrack) {
    return true;
  }

  return store.state.tracks.size <= 1;
});

const setMultiTrack = (enableMultiTrack: boolean) => {
  void changeExperimentalSetting("enableMultiTrack", enableMultiTrack);
  // 無効化するときはUndo/Redoをクリアする
  if (!enableMultiTrack) {
    void store.dispatch("CLEAR_UNDO_HISTORY");
  }
};
</script>

<style scoped lang="scss">
@use "@/styles/visually-hidden" as visually-hidden;
@use "@/styles/colors" as colors;
@use "@/styles/v2/colors" as colors-v2;
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;

.container {
  position: absolute;
  left: 0;
  right: 0;
  height: 100%;
  background-color: colors-v2.$background;
}

.headline {
  @include mixin.headline-2;
}

:global(.setting-dialog) {
  z-index: 1000 !important;
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
  margin: auto;
  max-width: 960px;
  padding: vars.$padding-2;
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
}

.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

.transition-container {
  display: flex;
  flex-direction: column;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: vars.$gap-1;
}
</style>
