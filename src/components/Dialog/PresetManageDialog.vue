<template>
  <QDialog
    :modelValue="props.openDialog"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
    @update:modelValue="updateOpenDialog"
  >
    <QLayout container view="hHh Lpr lff">
      <QHeader class="q-py-sm">
        <QToolbar>
          <QToolbarTitle class="text-display">プリセットの管理</QToolbarTitle>

          <QSpace />

          <QBtn
            round
            flat
            icon="close"
            color="display"
            @click="emit('update:openDialog', false)"
          />
        </QToolbar>
      </QHeader>

      <QPageContainer>
        <QPage class="main">
          <BaseNavigationView>
            <template #sidebar>
              <div class="list-title">プリセット一覧</div>
              <Draggable
                class="list-draggable"
                :modelValue="previewPresetList"
                itemKey="key"
                @update:modelValue="reorderPreset"
              >
                <template #item="{ element: item }">
                  <BaseListItem
                    :selected="selected?.key === item.key"
                    @click="selectPreset(item.key)"
                  >
                    <div class="listitem-content">
                      <span class="listitem-name">
                        {{ item.name }}
                      </span>
                      <div class="listitem-icon">
                        <BaseIconButton
                          icon="delete_outline"
                          label="削除"
                          @click="deletePreset(item.key)"
                        />
                      </div>
                    </div>
                  </BaseListItem>
                </template>
              </Draggable>
            </template>
            <div class="detail">
              <BaseScrollArea>
                <div v-if="selected" class="inner">
                  <div class="parameter-list">
                    <h2 class="preset-name">
                      {{ selected.preset.name }}
                    </h2>
                    <div class="preset-field">
                      <label for="preset-name">プリセット名</label>
                      <BaseTextField
                        id="preset-name"
                        :modelValue="selected.preset.name"
                        :hasError="!selected.preset.name"
                        @change="changePresetName"
                      />
                    </div>
                    <template
                      v-for="(value, sliderKey) in SLIDER_PARAMETERS"
                      :key="sliderKey"
                    >
                      <ParameterSlider
                        v-if="sliderKey in parameterLabels"
                        v-model="selected.preset[sliderKey as ParameterType]"
                        :sliderKey
                        :min="value.min()"
                        :max="value.max()"
                        :step="value.step()"
                        :scrollStep="value.scrollStep()"
                        :label="parameterLabels[sliderKey as ParameterType]"
                      />
                    </template>
                    <!-- NOTE: モーフィング無効時にキャラ選択解除するといきなり非表示になってしまうが、稀なケースなため無対策 -->
                    <template
                      v-if="shouldShowMorphing || selected.preset.morphingInfo"
                    >
                      <h3 class="parameter-headline">モーフィング</h3>
                      <div class="mophing-style">
                        <CharacterButton
                          :selectedVoice="
                            selected.preset.morphingInfo
                              ? {
                                  engineId:
                                    selected.preset.morphingInfo.targetEngineId,
                                  speakerId:
                                    selected.preset.morphingInfo
                                      .targetSpeakerId,
                                  styleId:
                                    selected.preset.morphingInfo.targetStyleId,
                                }
                              : undefined
                          "
                          :characterInfos="morphingTargetCharacters"
                          :showEngineInfo="morphingTargetEngines.length >= 2"
                          :emptiable="true"
                          :uiLocked="false"
                          @update:selectedVoice="handleSelectedVoiceUpdate"
                        />
                        <span>
                          {{
                            morphingTargetCharacterInfo
                              ? morphingTargetCharacterInfo.metas.speakerName
                              : "未設定"
                          }}
                        </span>
                        <span
                          v-if="
                            morphingTargetCharacterInfo &&
                            morphingTargetCharacterInfo.metas.styles.length >= 2
                          "
                        >
                          （{{ morphingTargetStyleInfo?.styleName }}）
                        </span>
                      </div>
                      <ParameterSlider
                        v-if="selected.preset.morphingInfo"
                        v-model="selected.preset.morphingInfo.rate"
                        sliderKey="morphingRate"
                        label="割合"
                        :min="SLIDER_PARAMETERS.morphingRate.min()"
                        :max="SLIDER_PARAMETERS.morphingRate.max()"
                        :step="SLIDER_PARAMETERS.morphingRate.step()"
                        :scrollStep="
                          SLIDER_PARAMETERS.morphingRate.scrollStep()
                        "
                      />
                    </template>
                  </div>
                </div>
              </BaseScrollArea>
            </div>
          </BaseNavigationView>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Draggable from "vuedraggable";
import { useStore } from "@/store";
import BaseListItem from "@/components/Base/BaseListItem.vue";
import BaseNavigationView from "@/components/Base/BaseNavigationView.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseTextField from "@/components/Base/BaseTextField.vue";
import CharacterButton from "@/components/CharacterButton.vue";
import ParameterSlider from "@/components/Talk/v2/ParameterSlider.vue";
import { useDefaultPreset } from "@/composables/useDefaultPreset";
import {
  CharacterInfo,
  Preset,
  PresetKey,
  PresetSliderKey,
  Voice,
} from "@/type/preload";
import { SLIDER_PARAMETERS } from "@/store/utility";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { debounce } from "@/helpers/timer";
import { UnreachableError } from "@/type/utility";

const props = defineProps<{
  openDialog: boolean;
}>();
const emit = defineEmits<{
  (e: "update:openDialog", val: boolean): void;
}>();

const updateOpenDialog = (isOpen: boolean) => emit("update:openDialog", isOpen);

const store = useStore();
const { isDefaultPresetKey } = useDefaultPreset();

const presetItems = computed(() => store.state.presetItems);
const presetKeys = computed(() => store.state.presetKeys);

const presetList = computed(() =>
  presetKeys.value
    .filter((key) => presetItems.value[key] != undefined)
    .filter((key) => !isDefaultPresetKey(key))
    .map((key) => ({
      key,
      ...presetItems.value[key],
    })),
);

const isPreview = ref(false);
const previewPresetKeys = ref(store.state.presetKeys);

const previewPresetList = computed(() =>
  isPreview.value
    ? previewPresetKeys.value
        .filter((key) => presetItems.value[key] != undefined)
        .filter((key) => !isDefaultPresetKey(key))
        .map((key) => ({
          key,
          ...presetItems.value[key],
        }))
    : presetList.value,
);

type ParameterType = Exclude<PresetSliderKey, "morphingRate">;
const parameterLabels: Record<ParameterType, string> = {
  speedScale: "話速",
  pitchScale: "音高",
  intonationScale: "抑揚",
  volumeScale: "音量",
  pauseLengthScale: "間の長さ",
  prePhonemeLength: "開始無音",
  postPhonemeLength: "終了無音",
};

const selected = ref<undefined | { key: PresetKey; preset: Preset }>();

const selectPreset = (key: PresetKey | undefined) => {
  if (key == undefined) {
    selected.value = undefined;
    return;
  }
  selected.value = {
    key,
    preset: cloneWithUnwrapProxy(presetItems.value[key]),
  };
};

watch(
  () => selected.value,
  debounce((value) => {
    if (value == undefined) {
      throw new UnreachableError();
    }
    if (value.preset.name == "") return;

    void store.actions.UPDATE_PRESET({
      presetData: value.preset,
      presetKey: value.key,
    });
  }, 300),
  { deep: true },
);

const changePresetName = (event: Event) => {
  if (event.target instanceof HTMLInputElement && selected.value) {
    selected.value.preset.name = event.target.value;
  }
};

const reorderPreset = (featurePresetList: (Preset & { key: PresetKey })[]) => {
  const newPresetKeys = featurePresetList.map((item) => item.key);
  previewPresetKeys.value = newPresetKeys;
  isPreview.value = true;

  // デフォルトプリセットは表示するlistから除外しているので、末尾に追加しておかないと失われる
  const defaultPresetKeys = presetKeys.value.filter(isDefaultPresetKey);

  void store.actions
    .SAVE_PRESET_ORDER({
      presetKeys: [...newPresetKeys, ...defaultPresetKeys],
    })
    .finally(() => (isPreview.value = false));
};

const deletePreset = async (key: PresetKey) => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "プリセットを削除しますか？",
    message: `プリセット "${presetItems.value[key].name}" を削除します。`,
    actionName: "削除する",
    isWarningColorButton: true,
  });
  if (result === "OK") {
    await store.actions.DELETE_PRESET({
      presetKey: key,
    });
  }
};

const shouldShowMorphing = computed(
  () => store.state.experimentalSetting.enableMorphing,
);

const morphingTargetEngines = store.getters.MORPHING_SUPPORTED_ENGINES;

const morphingTargetCharacters = computed<CharacterInfo[]>(() => {
  const allCharacterInfos = store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
  if (allCharacterInfos == undefined)
    throw new Error("USER_ORDERED_CHARACTER_INFOS == undefined");

  return allCharacterInfos;
});

const morphingTargetCharacterInfo = computed(() =>
  store.getters
    .USER_ORDERED_CHARACTER_INFOS("talk")
    ?.find(
      (character) =>
        character.metas.speakerUuid ===
        selected.value?.preset.morphingInfo?.targetSpeakerId,
    ),
);

const morphingTargetStyleInfo = computed(() => {
  const morphingInfo = selected.value?.preset.morphingInfo;
  if (!morphingInfo) return;

  return morphingTargetCharacterInfo.value?.metas.styles.find(
    (style) =>
      style.engineId === morphingInfo.targetEngineId &&
      style.styleId === morphingInfo.targetStyleId,
  );
});

const handleSelectedVoiceUpdate = (event: Voice | undefined) => {
  if (selected.value == undefined) {
    throw new Error("selectedPreset is undefined");
  }

  if (event == undefined) {
    selected.value.preset.morphingInfo = undefined;
    return;
  }

  selected.value.preset.morphingInfo = {
    targetEngineId: event.engineId,
    targetSpeakerId: event.speakerId,
    targetStyleId: event.styleId,
    rate: selected.value.preset.morphingInfo?.rate ?? 0.5,
  };
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

.list-title {
  @include mixin.headline-2;
  padding-bottom: vars.$padding-1;
}

.list-draggable {
  display: contents;
}

.listitem-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: vars.$gap-1;
  width: 320px;
}

.listitem-name {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
}

.listitem-icon {
  visibility: hidden;
}

.selected > * > .listitem-icon,
:hover > * > .listitem-icon {
  visibility: visible;
}

.detail {
  height: 100%;
}

.inner {
  display: flex;
  flex-direction: column;
  padding: vars.$padding-2;
  gap: vars.$gap-2;
  margin-inline: auto;
  max-width: 480px;
}

.preset-name {
  @include mixin.headline-1;
  word-break: break-all;
}

.preset-field {
  display: flex;
  flex-direction: column;
}

.parameter-headline {
  @include mixin.headline-2;
}

.parameter-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: vars.$gap-2;
}

.mophing-style {
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
}
</style>
