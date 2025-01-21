<template>
  <div v-if="query" class="root full-height q-py-md" data-testid="AudioInfo">
    <div v-if="enablePreset" class="q-px-md">
      <div class="row items-center no-wrap q-mb-xs">
        <div class="text-body1">プリセット</div>
        <QBtn dense flat icon="more_vert" :disable="uiLocked">
          <QMenu transitionDuration="100">
            <QList>
              <QItem
                v-close-popup
                clickable
                @click="registerPreset({ overwrite: false })"
              >
                <QItemSection avatar>
                  <QAvatar
                    icon="add_circle_outline"
                    color="primary"
                    textColor="display-on-primary"
                  ></QAvatar>
                </QItemSection>
                <QItemSection>
                  <QItemLabel>プリセット新規登録</QItemLabel>
                </QItemSection>
              </QItem>
              <QItem
                v-close-popup
                clickable
                @click="showsPresetEditDialog = true"
              >
                <QItemSection avatar>
                  <QAvatar
                    icon="edit_note"
                    color="primary"
                    textColor="display-on-primary"
                  ></QAvatar>
                </QItemSection>
                <QItemSection>
                  <QItemLabel>プリセット管理</QItemLabel>
                </QItemSection>
              </QItem>
            </QList>
          </QMenu>
        </QBtn>
      </div>

      <div class="full-width row" @wheel="setPresetByScroll($event)">
        <!-- TODO: 同じプリセットを選択したときにも複数選択中の他のAudioItemのプリセットを変更するようにする -->
        <QSelect
          v-model="presetSelectModel"
          :options="selectablePresetList"
          class="col overflow-hidden"
          color="primary"
          textColor="display-on-primary"
          outlined
          dense
          transitionShow="none"
          transitionHide="none"
          :disable="uiLocked"
        >
          <template #selected-item="scope">
            <div class="preset-select-label">
              {{ scope.opt.label }}
            </div>
          </template>
          <template #no-option>
            <QItem>
              <QItemSection class="text-grey">
                プリセットはありません
              </QItemSection>
            </QItem>
          </template>
        </QSelect>

        <QBtn
          v-show="!isRegisteredPreset || isChangedPreset"
          dense
          outline
          class="col-auto q-ml-xs"
          size="sm"
          textColor="display"
          :label="isRegisteredPreset ? '再登録' : '登録'"
          @click="registerPreset({ overwrite: isRegisteredPreset })"
        />
      </div>
      <!-- プリセット管理ダイアログ -->
      <PresetManageDialog v-model:open-dialog="showsPresetEditDialog" />

      <!-- プリセット登録ダイアログ -->
      <QDialog v-model="showsPresetNameDialog" @beforeHide="closeAllDialog">
        <QCard style="min-width: 350px">
          <QCardSection>
            <div class="text-h6">プリセット登録</div>
          </QCardSection>

          <QForm @submit.prevent="checkRewritePreset">
            <QCardSection class="q-pt-none">
              <QSelect
                fillInput
                autofocus
                hideSelected
                label="タイトル"
                color="primary"
                useInput
                inputDebounce="0"
                :modelValue="presetName"
                :options="presetOptionsList"
                @inputValue="setPresetName"
                @filter="filterPresetOptionsList"
              />
            </QCardSection>

            <QCardActions align="right">
              <QBtn
                v-close-popup
                flat
                label="キャンセル"
                @click="closeAllDialog"
              />
              <QBtn flat type="submit" label="確定" />
            </QCardActions>
          </QForm>
        </QCard>
      </QDialog>

      <!-- プリセット再登録ダイアログ -->
      <QDialog v-model="showsPresetRewriteDialog" @beforeHide="closeAllDialog">
        <QCard>
          <QCardSection>
            <div class="text-h6">プリセットの再登録</div>
          </QCardSection>
          <QCardSection>
            <QList>
              <QItem clickable class="no-margin" @click="updatePreset(true)">
                <QItemSection avatar>
                  <QAvatar icon="arrow_forward" textColor="blue" />
                </QItemSection>
                <QItemSection>
                  プリセットを再登録し、このプリセットが設定されたテキスト欄全てに再適用する
                </QItemSection>
              </QItem>
              <QItem clickable class="no-margin" @click="updatePreset(false)">
                <QItemSection avatar>
                  <QAvatar icon="arrow_forward" textColor="blue" />
                </QItemSection>
                <QItemSection> プリセットの再登録のみ行う </QItemSection>
              </QItem>
              <QItem
                v-close-popup
                clickable
                class="no-margin"
                @click="closeAllDialog"
              >
                <QItemSection avatar>
                  <QAvatar icon="arrow_forward" textColor="blue" />
                </QItemSection>
                <QItemSection>キャンセル</QItemSection>
              </QItem>
            </QList>
          </QCardSection>
        </QCard>
      </QDialog>

      <QSeparator class="q-mt-md" />
    </div>

    <div class="parameters q-px-md">
      <div v-for="parameter in parameters" :key="parameter.label">
        <QInput
          dense
          borderless
          maxlength="5"
          :class="{
            disabled: parameter.slider.qSliderProps.disable.value,
          }"
          :disable="parameter.slider.qSliderProps.disable.value"
          :modelValue="
            parameter.slider.state.currentValue.value != undefined
              ? parameter.slider.state.currentValue.value.toFixed(2)
              : parameter.slider.qSliderProps.min.value.toFixed(2)
          "
          @change="handleParameterChange(parameter, $event)"
        >
          <template #before
            ><span class="text-body1 text-display">{{
              parameter.label
            }}</span></template
          >
        </QInput>
        <QSlider
          dense
          snap
          color="primary"
          trackSize="2px"
          :min="parameter.slider.qSliderProps.min.value"
          :max="parameter.slider.qSliderProps.max.value"
          :step="parameter.slider.qSliderProps.step.value"
          :disable="parameter.slider.qSliderProps.disable.value"
          :modelValue="parameter.slider.qSliderProps.modelValue.value"
          @update:modelValue="
            parameter.slider.qSliderProps['onUpdate:modelValue']
          "
          @change="handleParameterChange(parameter, $event)"
          @wheel="parameter.slider.qSliderProps.onWheel"
          @pan="parameter.slider.qSliderProps.onPan"
        />
      </div>
    </div>
    <div
      v-if="shouldShowMorphing"
      class="q-px-md"
      :class="{
        disabled: uiLocked,
      }"
    >
      <QSeparator class="q-my-md" />
      <span class="text-body1 q-mb-xs">モーフィング</span>
      <div class="row no-wrap items-center">
        <CharacterButton
          v-model:selected-voice="morphingTargetVoice"
          class="q-my-xs"
          :characterInfos="morphingTargetCharacters"
          :showEngineInfo="morphingTargetEngines.length >= 2"
          :emptiable="true"
          :uiLocked
        />
        <div class="q-pl-xs row overflow-hidden">
          <div class="text-body2 ellipsis overflow-hidden">
            {{
              morphingTargetCharacterInfo
                ? morphingTargetCharacterInfo.metas.speakerName
                : "未設定"
            }}
          </div>
          <!-- 横幅が狭い場合に改行させるため分割 -->
          <div
            v-if="
              morphingTargetCharacterInfo &&
              morphingTargetCharacterInfo.metas.styles.length >= 2
            "
            class="text-body2 ellipsis overflow-hidden"
          >
            （{{
              morphingTargetStyleInfo
                ? morphingTargetStyleInfo.styleName
                : undefined
            }}）
          </div>
        </div>
      </div>
      <div
        v-if="!isSupportedMorphing"
        class="text-warning"
        style="font-size: 0.7rem"
      >
        非対応エンジンです
      </div>
      <div
        v-else-if="morphingTargetVoice && !isValidMorphingInfo"
        class="text-warning"
        style="font-size: 0.7rem"
      >
        無効な設定です
      </div>
      <div :class="{ disabled: morphingTargetStyleInfo == undefined }">
        <span class="text-body1 q-mb-xs"
          >割合
          {{
            morphingRateSlider.state.currentValue.value != undefined
              ? morphingRateSlider.state.currentValue.value.toFixed(2)
              : undefined
          }}</span
        >
        <QSlider
          dense
          snap
          color="primary"
          trackSize="2px"
          :min="morphingRateSlider.qSliderProps.min.value"
          :max="morphingRateSlider.qSliderProps.max.value"
          :step="morphingRateSlider.qSliderProps.step.value"
          :disable="
            morphingRateSlider.qSliderProps.disable.value ||
            morphingTargetStyleInfo == undefined
          "
          :modelValue="morphingRateSlider.qSliderProps.modelValue.value"
          @update:modelValue="
            morphingRateSlider.qSliderProps['onUpdate:modelValue']
          "
          @change="morphingRateSlider.qSliderProps.onChange"
          @wheel="morphingRateSlider.qSliderProps.onWheel"
          @pan="morphingRateSlider.qSliderProps.onPan"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { QSelectProps } from "quasar";
import CharacterButton from "@/components/CharacterButton.vue";
import PresetManageDialog from "@/components/Dialog/PresetManageDialog.vue";
import { useStore } from "@/store";

import {
  AudioKey,
  CharacterInfo,
  MorphingInfo,
  Preset,
  PresetKey,
  PresetSliderKey,
  Voice,
} from "@/type/preload";
import {
  previewSliderHelper,
  PreviewSliderHelper,
  Props as PreviewSliderHelperProps,
} from "@/helpers/previewSliderHelper";
import { EngineManifest } from "@/openapi";
import { useDefaultPreset } from "@/composables/useDefaultPreset";
import { SLIDER_PARAMETERS } from "@/store/utility";
import { createLogger } from "@/helpers/log";

const props = defineProps<{
  activeAudioKey: AudioKey;
}>();

const store = useStore();
const { info } = createLogger("AudioInfo");

// accent phrase
const uiLocked = computed(() => store.getters.UI_LOCKED);

const audioItem = computed(() => store.state.audioItems[props.activeAudioKey]);
const query = computed(() => audioItem.value?.query);

const supportedFeatures = computed(
  () =>
    (store.state.engineIds.some(
      (id) => id === audioItem.value.voice.engineId,
    ) &&
      store.state.engineManifests[audioItem.value.voice.engineId]
        .supportedFeatures) as EngineManifest["supportedFeatures"] | undefined,
);

const selectedAudioKeys = computed(() =>
  store.state.experimentalSetting.enableMultiSelect
    ? store.getters.SELECTED_AUDIO_KEYS
    : [props.activeAudioKey],
);

/** パラメーターを制御するための元情報リスト */
type ParameterConfig = {
  label: string;
  sliderProps: Omit<PreviewSliderHelperProps, "onChange">;
  onChange: PreviewSliderHelperProps["onChange"]; // NOTE: onChangeだけ使い回すので分離している
  key: PresetSliderKey;
};
const parameterConfigs = computed<ParameterConfig[]>(() => [
  {
    label: "話速",
    sliderProps: {
      modelValue: () => query.value?.speedScale ?? null,
      disable: () =>
        uiLocked.value || !supportedFeatures.value?.adjustSpeedScale,
      max: SLIDER_PARAMETERS.speedScale.max,
      min: SLIDER_PARAMETERS.speedScale.min,
      step: SLIDER_PARAMETERS.speedScale.step,
      scrollStep: SLIDER_PARAMETERS.speedScale.scrollStep,
      scrollMinStep: SLIDER_PARAMETERS.speedScale.scrollMinStep,
    },
    onChange: (speedScale: number) =>
      store.actions.COMMAND_MULTI_SET_AUDIO_SPEED_SCALE({
        audioKeys: selectedAudioKeys.value,
        speedScale,
      }),
    key: "speedScale",
  },
  {
    label: "音高",
    sliderProps: {
      modelValue: () => query.value?.pitchScale ?? null,
      disable: () =>
        uiLocked.value || !supportedFeatures.value?.adjustPitchScale,
      max: SLIDER_PARAMETERS.pitchScale.max,
      min: SLIDER_PARAMETERS.pitchScale.min,
      step: SLIDER_PARAMETERS.pitchScale.step,
      scrollStep: SLIDER_PARAMETERS.pitchScale.scrollStep,
    },
    onChange: (pitchScale: number) =>
      store.actions.COMMAND_MULTI_SET_AUDIO_PITCH_SCALE({
        audioKeys: selectedAudioKeys.value,
        pitchScale,
      }),
    key: "pitchScale",
  },
  {
    label: "抑揚",
    sliderProps: {
      modelValue: () => query.value?.intonationScale ?? null,
      disable: () =>
        uiLocked.value || !supportedFeatures.value?.adjustIntonationScale,
      max: SLIDER_PARAMETERS.intonationScale.max,
      min: SLIDER_PARAMETERS.intonationScale.min,
      step: SLIDER_PARAMETERS.intonationScale.step,
      scrollStep: SLIDER_PARAMETERS.intonationScale.scrollStep,
      scrollMinStep: SLIDER_PARAMETERS.intonationScale.scrollMinStep,
    },
    onChange: (intonationScale: number) =>
      store.actions.COMMAND_MULTI_SET_AUDIO_INTONATION_SCALE({
        audioKeys: selectedAudioKeys.value,
        intonationScale,
      }),
    key: "intonationScale",
  },
  {
    label: "音量",
    sliderProps: {
      modelValue: () => query.value?.volumeScale ?? null,
      disable: () =>
        uiLocked.value || !supportedFeatures.value?.adjustVolumeScale,
      max: SLIDER_PARAMETERS.volumeScale.max,
      min: SLIDER_PARAMETERS.volumeScale.min,
      step: SLIDER_PARAMETERS.volumeScale.step,
      scrollStep: SLIDER_PARAMETERS.volumeScale.scrollStep,
      scrollMinStep: SLIDER_PARAMETERS.volumeScale.scrollMinStep,
    },
    onChange: (volumeScale: number) =>
      store.actions.COMMAND_MULTI_SET_AUDIO_VOLUME_SCALE({
        audioKeys: selectedAudioKeys.value,
        volumeScale,
      }),
    key: "volumeScale",
  },
  {
    label: "間の長さ",
    sliderProps: {
      modelValue: () => query.value?.pauseLengthScale ?? null,
      disable: () =>
        uiLocked.value || !supportedFeatures.value?.adjustPauseLength,
      max: SLIDER_PARAMETERS.pauseLengthScale.max,
      min: SLIDER_PARAMETERS.pauseLengthScale.min,
      step: SLIDER_PARAMETERS.pauseLengthScale.step,
      scrollStep: SLIDER_PARAMETERS.pauseLengthScale.scrollStep,
      scrollMinStep: SLIDER_PARAMETERS.pauseLengthScale.scrollMinStep,
    },
    onChange: (pauseLengthScale: number) =>
      store.actions.COMMAND_MULTI_SET_AUDIO_PAUSE_LENGTH_SCALE({
        audioKeys: selectedAudioKeys.value,
        pauseLengthScale,
      }),
    key: "pauseLengthScale",
  },
  {
    label: "開始無音",
    sliderProps: {
      modelValue: () => query.value?.prePhonemeLength ?? null,
      disable: () => uiLocked.value,
      max: SLIDER_PARAMETERS.prePhonemeLength.max,
      min: SLIDER_PARAMETERS.prePhonemeLength.min,
      step: SLIDER_PARAMETERS.prePhonemeLength.step,
      scrollStep: SLIDER_PARAMETERS.prePhonemeLength.scrollStep,
      scrollMinStep: SLIDER_PARAMETERS.prePhonemeLength.scrollMinStep,
    },
    onChange: (prePhonemeLength: number) =>
      store.actions.COMMAND_MULTI_SET_AUDIO_PRE_PHONEME_LENGTH({
        audioKeys: selectedAudioKeys.value,
        prePhonemeLength,
      }),
    key: "prePhonemeLength",
  },
  {
    label: "終了無音",
    sliderProps: {
      modelValue: () => query.value?.postPhonemeLength ?? null,
      disable: () => uiLocked.value,
      max: SLIDER_PARAMETERS.postPhonemeLength.max,
      min: SLIDER_PARAMETERS.postPhonemeLength.min,
      step: SLIDER_PARAMETERS.postPhonemeLength.step,
      scrollStep: SLIDER_PARAMETERS.postPhonemeLength.scrollStep,
      scrollMinStep: SLIDER_PARAMETERS.postPhonemeLength.scrollMinStep,
    },
    onChange: (postPhonemeLength: number) =>
      store.actions.COMMAND_MULTI_SET_AUDIO_POST_PHONEME_LENGTH({
        audioKeys: selectedAudioKeys.value,
        postPhonemeLength,
      }),
    key: "postPhonemeLength",
  },
]);

/** パラメーター制御用 */
type Parameter = {
  label: string;
  slider: PreviewSliderHelper;
  onChange: PreviewSliderHelperProps["onChange"];
  key: PresetSliderKey;
};
const parameters = computed<Parameter[]>(() =>
  parameterConfigs.value.map((parameterConfig) => ({
    label: parameterConfig.label,
    slider: previewSliderHelper({
      ...parameterConfig.sliderProps,
      onChange: parameterConfig.onChange,
    }),
    onChange: parameterConfig.onChange,
    key: parameterConfig.key,
  })),
);

const handleParameterChange = (
  parameter: Parameter,
  inputValue: string | number | null,
) => {
  if (inputValue == null) throw new Error("inputValue is null");
  const value = adjustSliderValue(
    parameter.label + "入力",
    inputValue.toString(),
    parameter.slider.qSliderProps.min.value,
    parameter.slider.qSliderProps.max.value,
  );
  return parameter.onChange(value);
};

// モーフィング
const shouldShowMorphing = computed(
  () => store.state.experimentalSetting.enableMorphing,
);

const isSupportedMorphing = computed(
  () => supportedFeatures.value?.synthesisMorphing,
);

const isValidMorphingInfo = computed(() =>
  store.getters.VALID_MORPHING_INFO(audioItem.value),
);

const morphingTargetEngines = store.getters.MORPHING_SUPPORTED_ENGINES;

// モーフィング可能なターゲット一覧を取得
watchEffect(() => {
  if (audioItem.value != undefined) {
    void store.actions.LOAD_MORPHABLE_TARGETS({
      engineId: audioItem.value.voice.engineId,
      baseStyleId: audioItem.value.voice.styleId,
    });
  }
});

const morphingTargetCharacters = computed<CharacterInfo[]>(() => {
  const allCharacterInfos = store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
  if (allCharacterInfos == undefined)
    throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");

  const baseEngineId = audioItem.value.voice.engineId;
  const baseStyleId = audioItem.value.voice.styleId;

  // モーフィング対象リストを問い合わせていないときはとりあえず空欄を表示
  // FIXME: そもそもモーフィングUIを表示しないようにする
  const morphableTargets =
    store.state.morphableTargetsInfo[baseEngineId]?.[baseStyleId] ?? {};

  const morphableStyleIds = Object.entries(morphableTargets) // FIXME: Voiceにするべき
    .filter(([, value]) => value.isMorphable)
    .map(([styleId]) => parseInt(styleId));

  const characterInfos: CharacterInfo[] = allCharacterInfos
    // モーフィング可能なスタイルのみを残す
    .map((character) => {
      const styles = character.metas.styles.filter(
        (style) =>
          morphableStyleIds.includes(style.styleId) &&
          style.engineId == baseEngineId,
      );
      return {
        ...character,
        metas: {
          ...character.metas,
          styles,
        },
      };
    })
    // スタイルが１つもないキャラクターは省く
    .filter((characters) => characters.metas.styles.length >= 1);

  // 選択中のキャラがいない場合は一番上に追加する
  if (
    morphingTargetVoice.value != undefined &&
    !characterInfos.some(
      (info) => info.metas.speakerUuid == morphingTargetVoice.value?.speakerId,
    )
  ) {
    const info = allCharacterInfos.find(
      (info) => info.metas.speakerUuid == morphingTargetVoice.value?.speakerId,
    );
    if (info == undefined) throw new Error("info == undefined");
    characterInfos.unshift(info);
  }

  return characterInfos;
});

const morphingTargetVoice = computed({
  get() {
    const morphingInfo = audioItem.value.morphingInfo;
    if (morphingInfo == undefined) return undefined;
    return {
      engineId: morphingInfo.targetEngineId,
      speakerId: morphingInfo.targetSpeakerId,
      styleId: morphingInfo.targetStyleId,
    };
  },
  set(voice: Voice | undefined) {
    const morphingInfo =
      voice != undefined
        ? {
            rate: audioItem.value.morphingInfo?.rate ?? 0.5,
            targetEngineId: voice.engineId,
            targetSpeakerId: voice.speakerId,
            targetStyleId: voice.styleId,
          }
        : undefined;
    void store.actions.COMMAND_MULTI_SET_MORPHING_INFO({
      audioKeys: selectedAudioKeys.value,
      morphingInfo,
    });
  },
});

const morphingTargetCharacterInfo = computed(() =>
  store.getters
    .USER_ORDERED_CHARACTER_INFOS("talk")
    ?.find(
      (character) =>
        character.metas.speakerUuid === morphingTargetVoice.value?.speakerId,
    ),
);

const morphingTargetStyleInfo = computed(() => {
  const targetVoice = morphingTargetVoice.value;
  return morphingTargetCharacterInfo.value?.metas.styles.find(
    (style) =>
      style.engineId === targetVoice?.engineId &&
      style.styleId === targetVoice.styleId,
  );
});

const setMorphingRate = (rate: number) => {
  const info = audioItem.value.morphingInfo;
  if (info == undefined) {
    throw new Error("audioItem.value.morphingInfo == undefined");
  }
  return store.actions.COMMAND_MULTI_SET_MORPHING_INFO({
    audioKeys: selectedAudioKeys.value,
    morphingInfo: {
      rate,
      targetEngineId: info.targetEngineId,
      targetSpeakerId: info.targetSpeakerId,
      targetStyleId: info.targetStyleId,
    },
  });
};
const morphingRateSlider = previewSliderHelper({
  modelValue: () => audioItem.value.morphingInfo?.rate ?? null,
  disable: () => uiLocked.value,
  onChange: setMorphingRate,
  max: SLIDER_PARAMETERS.morphingRate.max,
  min: SLIDER_PARAMETERS.morphingRate.min,
  step: SLIDER_PARAMETERS.morphingRate.step,
  scrollStep: SLIDER_PARAMETERS.morphingRate.scrollStep,
  scrollMinStep: SLIDER_PARAMETERS.morphingRate.scrollMinStep,
});

// プリセット
const enablePreset = computed(() => store.state.enablePreset);

const presetItems = computed(() => store.state.presetItems);
const presetKeys = computed(() => store.state.presetKeys);
const audioPresetKey = computed(() => audioItem.value?.presetKey);
const isRegisteredPreset = computed(
  () =>
    audioPresetKey.value != undefined &&
    presetItems.value[audioPresetKey.value] != undefined,
);

const { isDefaultPresetKey, getDefaultPresetKeyForVoice } = useDefaultPreset();

const currentDefaultPresetKey = computed(() =>
  getDefaultPresetKeyForVoice(audioItem.value.voice),
);

// 入力パラメータがプリセットから変更されたか
const isChangedPreset = computed(() => {
  if (!isRegisteredPreset.value) return false;

  // プリセットの値を取得
  if (audioPresetKey.value == undefined)
    throw new Error("audioPresetKey is undefined"); // 次のコードが何故かコンパイルエラーになるチェック
  const preset = presetItems.value[audioPresetKey.value];
  const { name: _, morphingInfo, ...presetParts } = preset;

  // 入力パラメータと比較
  const keys = Object.keys(presetParts) as (keyof Omit<
    Preset,
    "name" | "morphingInfo"
  >)[];
  if (
    keys.some((key) => presetParts[key] !== presetPartsFromParameter.value[key])
  )
    return true;
  const morphingInfoFromParameter = presetPartsFromParameter.value.morphingInfo;
  if (morphingInfo && morphingInfoFromParameter) {
    const morphingInfoKeys = Object.keys(
      morphingInfo,
    ) as (keyof MorphingInfo)[];
    return morphingInfoKeys.some(
      (key) => morphingInfo[key] !== morphingInfoFromParameter[key],
    );
  }
  return morphingInfo != morphingInfoFromParameter;
});

type PresetSelectModelType = {
  label: string;
  key: PresetKey | undefined;
};

// プリセットの変更
const changePreset = (presetKey: PresetKey | undefined) =>
  store.actions.COMMAND_MULTI_SET_AUDIO_PRESET({
    audioKeys: selectedAudioKeys.value,
    presetKey,
  });

const presetList = computed<{ label: string; key: PresetKey }[]>(() =>
  presetKeys.value
    .filter((key) => presetItems.value[key] != undefined)
    .map((key) => ({
      key,
      label: presetItems.value[key].name,
    })),
);

// セルへのプリセットの設定
const selectablePresetList = computed<PresetSelectModelType[]>(() => {
  const topPresetList: { key: PresetKey | undefined; label: string }[] = [];

  if (isRegisteredPreset.value) {
    topPresetList.push({
      key: undefined,
      label: "プリセット解除",
    });
  }

  // 選択中のstyleのデフォルトプリセットは常に一番上
  topPresetList.push(
    ...presetList.value.filter(
      (preset) => preset.key === currentDefaultPresetKey.value,
    ),
  );
  // 他のstyleのデフォルトプリセットを除外
  const commonPresets = presetList.value.filter(
    (preset) => !isDefaultPresetKey(preset.key),
  );

  return [...topPresetList, ...commonPresets];
});

const presetSelectModel = computed<PresetSelectModelType>({
  get: () => {
    if (!isRegisteredPreset.value)
      return {
        label: "プリセット選択",
        key: undefined,
      };
    if (audioPresetKey.value == undefined)
      throw new Error("audioPresetKey is undefined"); // 次のコードが何故かコンパイルエラーになるチェック

    return {
      label: presetItems.value[audioPresetKey.value].name,
      key: audioPresetKey.value,
    };
  },
  set: (newVal) => {
    void changePreset(newVal.key);
  },
});

const setPresetByScroll = (event: WheelEvent) => {
  event.preventDefault();

  const presetNumber = selectablePresetList.value.length;
  if (presetNumber === 0 || presetNumber == undefined) return;

  const nowIndex = selectablePresetList.value.findIndex(
    (value) => value.key == presetSelectModel.value.key,
  );

  const isUp = event.deltaY > 0;
  const newIndex = isUp ? nowIndex + 1 : nowIndex - 1;
  if (newIndex < 0 || presetNumber <= newIndex) return;

  if (selectablePresetList.value[newIndex] == undefined) return;

  void changePreset(selectablePresetList.value[newIndex].key);
};

// プリセットの登録・再登録
const showsPresetNameDialog = ref(false);
const showsPresetRewriteDialog = ref(false);
const presetName = ref("");

const setPresetName = (name: string) => {
  presetName.value = name;
};

const closeAllDialog = () => {
  presetName.value = "";
  showsPresetNameDialog.value = false;
  showsPresetRewriteDialog.value = false;
};

// プリセットの登録
const registerPreset = ({ overwrite }: { overwrite: boolean }) => {
  // 既存の場合は名前をセット
  if (isRegisteredPreset.value) {
    if (audioPresetKey.value == undefined)
      throw new Error("audioPresetKey is undefined"); // 次のコードが何故かコンパイルエラーになるチェック
    presetName.value = presetItems.value[audioPresetKey.value].name;
  }

  // 既存で再登録する場合は再登録ダイアログを表示
  if (isRegisteredPreset.value && overwrite) {
    showsPresetRewriteDialog.value = true;
    return;
  }

  // それ以外はダイアログを表示
  showsPresetNameDialog.value = true;
};

const presetOptionsList = ref<string[]>([]);
const filterPresetOptionsList: QSelectProps["onFilter"] = (
  inputValue,
  doneFn,
) => {
  const presetNames = presetKeys.value
    .filter((presetKey) => !isDefaultPresetKey(presetKey))
    .map((presetKey) => presetItems.value[presetKey]?.name)
    .filter((value) => value != undefined);
  doneFn(() => {
    presetOptionsList.value = presetNames.filter((name) =>
      name.startsWith(inputValue),
    );
  });
};

const checkRewritePreset = async () => {
  if (presetList.value.find((e) => e.label === presetName.value)) {
    showsPresetRewriteDialog.value = true;
  } else {
    const audioPresetKey = await addPreset();
    void changePreset(audioPresetKey);
  }
};

// 入力パラメータから、name以外のPresetを取得
const presetPartsFromParameter = computed<Omit<Preset, "name">>(() => {
  if (
    parameters.value.some(
      (parameter) => parameter.slider.state.currentValue.value == undefined,
    )
  )
    throw new Error("slider value is null");

  return {
    ...parameters.value.reduce(
      (acc, parameter) => ({
        ...acc,
        [parameter.key]: parameter.slider.state.currentValue.value,
      }),
      {} as {
        [K in (typeof parameters.value)[number]["key"]]: number;
      },
    ),
    morphingInfo:
      morphingTargetStyleInfo.value &&
      morphingTargetCharacterInfo.value &&
      morphingRateSlider.state.currentValue.value != undefined // FIXME: ifでチェックしてthrowする
        ? {
            rate: morphingRateSlider.state.currentValue.value,
            targetEngineId: morphingTargetStyleInfo.value.engineId,
            targetSpeakerId:
              morphingTargetCharacterInfo.value.metas.speakerUuid,
            targetStyleId: morphingTargetStyleInfo.value.styleId,
          }
        : undefined,
  };
});

const createPresetData = (name: string): Preset => {
  return { name, ...presetPartsFromParameter.value };
};

// プリセット新規追加
const addPreset = () => {
  const name = presetName.value;
  const newPreset = createPresetData(name);
  if (newPreset == undefined) throw Error("newPreset == undefined");

  closeAllDialog();

  return store.actions.ADD_PRESET({
    presetData: newPreset,
  });
};

const updatePreset = async (fullApply: boolean) => {
  const key = presetList.value.find(
    (preset) => preset.label === presetName.value,
  )?.key;
  if (key == undefined) return;

  const title = presetName.value;
  const newPreset = createPresetData(title);
  if (newPreset == undefined) return;

  await store.actions.UPDATE_PRESET({
    presetData: newPreset,
    presetKey: key,
  });

  if (fullApply) {
    await store.actions.COMMAND_FULLY_APPLY_AUDIO_PRESET({
      presetKey: key,
    });
  }

  closeAllDialog();
};

// プリセットの編集
const showsPresetEditDialog = ref(false);

const adjustSliderValue = (
  inputItemName: string,
  inputStr: string,
  minimalVal: number,
  maximamVal: number,
) => {
  const convertedInputStr = convertFullWidthNumbers(inputStr);
  const inputNum = Number(convertedInputStr);

  info(`${inputItemName}: ${inputStr}`);

  if (isNaN(inputNum)) {
    return minimalVal;
  }
  if (inputNum < minimalVal) {
    return minimalVal;
  }
  if (maximamVal < inputNum) {
    return maximamVal;
  }

  return inputNum;
};

const convertFullWidthNumbers = (inputStr: string) => {
  const numberConversionMap = [
    ["０", "0"],
    ["１", "1"],
    ["２", "2"],
    ["３", "3"],
    ["４", "4"],
    ["５", "5"],
    ["６", "6"],
    ["７", "7"],
    ["８", "8"],
    ["９", "9"],
    ["。", "."],
    ["．", "."],
    ["ー", "-"],
  ];

  let convertedInputStr = inputStr;
  for (const [pattern, replacement] of numberConversionMap) {
    const regex = new RegExp(pattern, "g");
    convertedInputStr = convertedInputStr.replace(regex, replacement);
  }
  return convertedInputStr;
};
</script>

<style scoped lang="scss">
.root {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 0px 0;
  overflow-y: scroll;
}

.parameters {
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.preset-select-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: fit-content;
}
</style>
