<template>
  <QDialog
    :modelValue="props.openDialog"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
    @update:modelValue="updateOpenDialog"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
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
                    :selected="selectedPresetKey === item.key"
                    @click="selectedPresetKey = item.key"
                  >
                    <div class="listitem-content">
                      {{ item.name }}
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
                <div v-if="selectedPreset" class="inner">
                  <div class="parameter-list">
                    <h2 class="preset-name">{{ selectedPreset.name }}</h2>
                    <template
                      v-for="(value, sliderKey) in SLIDER_PARAMETERS"
                      :key="sliderKey"
                    >
                      <div
                        v-if="sliderKey in parameterLabels"
                        class="parameter"
                      >
                        <div class="parameter-header">
                          <span>
                            {{ parameterLabels[sliderKey as ParameterType] }}
                          </span>
                          <span>
                            {{
                              selectedPreset[
                                sliderKey as ParameterType
                              ].toFixed(2)
                            }}
                          </span>
                        </div>
                        <!-- NOTE: プルリクエスト分割のため、まずは動かないスライダーが実装されている。変更機能も実装予定。 -->
                        <BaseSlider
                          :min="value.min()"
                          :max="value.max()"
                          :step="value.step()"
                          :modelValue="
                            selectedPreset[sliderKey as ParameterType]
                          "
                        />
                      </div>
                    </template>
                  </div>
                  <div
                    v-if="selectedPreset.morphingInfo"
                    class="parameter-list"
                  >
                    <h3 class="parameter-headline">モーフィング</h3>
                    <div class="mophing-style">
                      <CharacterButton
                        v-if="morphingTargetCharacterInfo"
                        :selectedVoice="{
                          engineId: selectedPreset.morphingInfo.targetEngineId,
                          speakerId:
                            selectedPreset.morphingInfo.targetSpeakerId,
                          styleId: selectedPreset.morphingInfo.targetStyleId,
                        }"
                        :characterInfos="[morphingTargetCharacterInfo]"
                        :showEngineInfo="morphingTargetEngines.length >= 2"
                        :emptiable="true"
                        :uiLocked="false"
                      />
                      <span v-if="morphingTargetCharacterInfo">
                        {{ morphingTargetCharacterInfo.metas.speakerName }}
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
                    <div class="parameter">
                      <div class="parameter-header">
                        <span>割合</span>
                        <span>
                          {{ selectedPreset.morphingInfo.rate.toFixed(2) }}
                        </span>
                      </div>
                      <!-- NOTE: プルリクエスト分割のため、まずは動かないスライダーが実装されている。変更機能も実装予定。 -->
                      <BaseSlider
                        :min="SLIDER_PARAMETERS.morphingRate.min()"
                        :max="SLIDER_PARAMETERS.morphingRate.max()"
                        :step="SLIDER_PARAMETERS.morphingRate.step()"
                        :modelValue="selectedPreset.morphingInfo.rate"
                      />
                    </div>
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
import { computed, ref } from "vue";
import Draggable from "vuedraggable";
import { useStore } from "@/store";
import BaseListItem from "@/components/Base/BaseListItem.vue";
import BaseNavigationView from "@/components/Base/BaseNavigationView.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseSlider from "@/components/Base/BaseSlider.vue";
import CharacterButton from "@/components/CharacterButton.vue";
import { useDefaultPreset } from "@/composables/useDefaultPreset";
import { Preset, PresetKey, PresetSliderKey } from "@/type/preload";
import { SLIDER_PARAMETERS } from "@/store/utility";

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

const morphingTargetEngines = store.getters.MORPHING_SUPPORTED_ENGINES;

const selectedPresetKey = ref();
const selectedPreset = computed(() => {
  return previewPresetList.value.find(
    (preset) => preset.key === selectedPresetKey.value,
  );
});

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

const morphingTargetCharacterInfo = computed(() =>
  store.getters
    .USER_ORDERED_CHARACTER_INFOS("talk")
    ?.find(
      (character) =>
        character.metas.speakerUuid ===
        selectedPreset.value?.morphingInfo?.targetSpeakerId,
    ),
);

const morphingTargetStyleInfo = computed(() => {
  const morphingInfo = selectedPreset.value?.morphingInfo;

  if (!morphingInfo) return;

  return morphingTargetCharacterInfo.value?.metas.styles.find(
    (style) =>
      style.engineId === morphingInfo.targetEngineId &&
      style.styleId === morphingInfo.targetStyleId,
  );
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
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
  width: 100%;
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
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: vars.$padding-2;
  gap: vars.$gap-2;
}

.preset-name {
  @include mixin.headline-1;
}

.parameter-headline {
  @include mixin.headline-2;
}

.parameter-list {
  margin-inline: auto;
  max-width: 480px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: vars.$gap-2;
}

.parameter-header {
  display: flex;
  justify-content: space-between;
}

.mophing-style {
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
}
</style>
