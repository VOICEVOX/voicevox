<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStore } from "@/store";
import { CharacterInfo, DefaultStyleId, StyleInfo } from "@/type/preload";

const props =
  defineProps<{
    modelValue: boolean;
    characterInfos: CharacterInfo[];
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", value: boolean): void;
  }>();

const store = useStore();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

// 複数スタイルあるキャラクター
const multiStyleCharacterInfos = computed(() => {
  return props.characterInfos.filter(
    (characterInfo) => characterInfo.metas.styles.length > 1
  );
});

const selectedStyleIndexes = ref<(number | undefined)[]>([]);

// ダイアログが開かれたときに初期値を求める
watch(
  () => props.modelValue,
  async (newValue, oldValue) => {
    if (!oldValue && newValue) {
      selectedStyleIndexes.value = await Promise.all(
        multiStyleCharacterInfos.value.map(async (info) => {
          const defaultStyleId = store.state.defaultStyleIds.find(
            (x) => x.speakerUuid === info.metas.speakerUuid
          )?.defaultStyleId;

          const index = info.metas.styles.findIndex(
            (style) => style.styleId === defaultStyleId
          );
          return index === -1 ? undefined : index;
        })
      );
    }
  }
);

const selectStyleIndex = (characterIndex: number, styleIndex: number) => {
  selectedStyleIndexes.value[characterIndex] = styleIndex;

  // 音声を再生する。同じ話者/styleIndexだったら停止する。
  const selectedCharacter = multiStyleCharacterInfos.value[characterIndex];
  const selectedStyleInfo = selectedCharacter.metas.styles[styleIndex];
  if (
    playing.value !== undefined &&
    playing.value.speakerUuid === selectedCharacter.metas.speakerUuid &&
    playing.value.styleId === selectedStyleInfo.styleId
  ) {
    stop();
  } else {
    play(selectedCharacter.metas.speakerUuid, selectedStyleInfo, 0);
  }
};

const pageIndex = ref(0);

const isHoverableStyleItem = ref(true);

const playing = ref<{ speakerUuid: string; styleId: number; index: number }>();

const audio = new Audio();
audio.volume = 0.5;
audio.onended = () => stop();

const canNext = computed(() => {
  const selectedStyleIndex = selectedStyleIndexes.value[pageIndex.value];
  return selectedStyleIndex !== undefined;
});

const play = (
  speakerUuid: string,
  { styleId, voiceSamplePaths }: StyleInfo,
  index: number
) => {
  if (audio.src !== "") stop();

  audio.src = voiceSamplePaths[index];
  audio.play();
  playing.value = { speakerUuid, styleId, index };
};
const stop = () => {
  if (audio.src === "") return;

  audio.pause();
  audio.removeAttribute("src");
  playing.value = undefined;
};

const prevPage = () => {
  stop();
  pageIndex.value--;
};
const nextPage = () => {
  stop();
  pageIndex.value++;
};

// 既に設定が存在する場合があるので、新しい設定と既存設定を合成させる
const closeDialog = () => {
  const defaultStyleIds = JSON.parse(
    JSON.stringify(store.state.defaultStyleIds)
  ) as DefaultStyleId[];
  multiStyleCharacterInfos.value.forEach((info, idx) => {
    const defaultStyleInfo = {
      speakerUuid: info.metas.speakerUuid,
      defaultStyleId:
        info.metas.styles[selectedStyleIndexes.value[idx] ?? 0].styleId,
    };
    const nowSettingIndex = defaultStyleIds.findIndex(
      (s) => s.speakerUuid === info.metas.speakerUuid
    );
    if (nowSettingIndex !== -1) {
      defaultStyleIds[nowSettingIndex] = defaultStyleInfo;
    } else {
      defaultStyleIds.push(defaultStyleInfo);
    }
  });
  store.dispatch("SET_DEFAULT_STYLE_IDS", defaultStyleIds);

  stop();
  modelValueComputed.value = false;
  pageIndex.value = 0;
};
</script>

<template>
  <QDialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="default-style-select-dialog transparent-backdrop"
    v-model="modelValueComputed"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <div class="column">
            <QToolbarTitle class="text-display"
              >設定 / デフォルトスタイル・試聴</QToolbarTitle
            >
          </div>

          <QSpace />

          <div class="row items-center no-wrap">
            <QBtn
              v-show="pageIndex >= 1"
              unelevated
              label="戻る"
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap q-mr-md"
              @click="prevPage"
            />

            <div class="text-subtitle2 text-no-wrap text-display q-mr-md">
              {{ pageIndex + 1 }} / {{ multiStyleCharacterInfos.length }}
            </div>

            <QBtn
              v-if="pageIndex + 1 < multiStyleCharacterInfos.length"
              v-show="canNext"
              unelevated
              label="次へ"
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap"
              @click="nextPage"
            />
            <QBtn
              v-else
              v-show="canNext"
              unelevated
              label="完了"
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap"
              @click="closeDialog"
            />
          </div>
        </QToolbar>
      </QHeader>

      <QDrawer
        bordered
        show-if-above
        :model-value="true"
        :width="$q.screen.width / 3"
        :breakpoint="0"
      >
        <div class="character-portrait-wrapper">
          <img
            v-if="multiStyleCharacterInfos.length > 0"
            :src="multiStyleCharacterInfos[pageIndex].portraitPath"
            class="character-portrait"
          />
        </div>
      </QDrawer>

      <QPageContainer>
        <QPage v-if="multiStyleCharacterInfos && selectedStyleIndexes">
          <QTabPanels v-model="pageIndex">
            <QTabPanel
              v-for="(
                characterInfo, characterIndex
              ) of multiStyleCharacterInfos"
              :key="characterIndex"
              :name="characterIndex"
            >
              <div class="text-h6 character-name">
                {{ characterInfo.metas.speakerName }}
              </div>

              <div class="style-items-container">
                <div class="q-pb-md">
                  <QItem
                    v-for="(style, styleIndex) of characterInfo.metas.styles"
                    :key="styleIndex"
                    clickable
                    v-ripple="isHoverableStyleItem"
                    class="q-pa-none style-item"
                    :class="[
                      selectedStyleIndexes[characterIndex] === styleIndex &&
                        'active-style-item',
                      isHoverableStyleItem && 'hoverable-style-item',
                    ]"
                    @click="selectStyleIndex(characterIndex, styleIndex)"
                  >
                    <div class="style-item-inner">
                      <img :src="style.iconPath" class="style-icon" />
                      <span class="text-subtitle1 q-ma-sm">{{
                        style.styleName || "ノーマル"
                      }}</span>
                      <div class="voice-samples">
                        <QBtn
                          v-for="voiceSampleIndex of [...Array(3).keys()]"
                          :key="voiceSampleIndex"
                          round
                          outline
                          :icon="
                            playing != undefined &&
                            characterInfo.metas.speakerUuid ===
                              playing.speakerUuid &&
                            style.styleId === playing.styleId &&
                            voiceSampleIndex === playing.index
                              ? 'stop'
                              : 'play_arrow'
                          "
                          color="primary-light"
                          class="voice-sample-btn"
                          @mouseenter="isHoverableStyleItem = false"
                          @mouseleave="isHoverableStyleItem = true"
                          @click.stop="
                            playing != undefined &&
                            characterInfo.metas.speakerUuid ===
                              playing.speakerUuid &&
                            style.styleId === playing.styleId &&
                            voiceSampleIndex === playing.index
                              ? stop()
                              : play(
                                  characterInfo.metas.speakerUuid,
                                  style,
                                  voiceSampleIndex
                                )
                          "
                        />
                        <QRadio
                          class="
                            absolute-top-right
                            no-pointer-events
                            text-primary-light
                          "
                          :model-value="selectedStyleIndexes[characterIndex]"
                          :val="styleIndex"
                          @update:model-value="
                            selectStyleIndex(characterIndex, styleIndex)
                          "
                        />
                      </div>
                    </div>
                  </QItem>
                </div>
              </div>
            </QTabPanel>
          </QTabPanels>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-toolbar div:first-child {
  min-width: 0;
}
.character-portrait-wrapper {
  display: grid;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  .character-portrait {
    margin: auto;
  }
}
.q-tab-panels {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width}
  );

  > :deep(.scroll) {
    overflow-y: scroll;
    .q-tab-panel {
      padding: 5px 16px;
    }
  }

  $character-name-height: 30px;
  .character-name {
    height: $character-name-height;
  }

  .style-items-container {
    display: grid;
    align-items: center;
    height: calc(100% - #{$character-name-height});
    > div {
      $style-item-size: 215px;
      display: grid;
      grid-template-columns: repeat(auto-fit, $style-item-size);
      grid-auto-rows: $style-item-size;
      column-gap: 10px;
      row-gap: 10px;
      align-content: center;
      justify-content: center;
      .style-item {
        box-shadow: 0 0 0 1px rgba(colors.$primary-light-rgb, 0.5);
        border-radius: 10px;
        overflow: hidden;
        &.active-style-item {
          box-shadow: 0 0 0 2px colors.$primary-light;
        }
        &:hover :deep(.q-focus-helper) {
          opacity: 0 !important;
        }
        &.hoverable-style-item:hover :deep(.q-focus-helper) {
          opacity: 0.15 !important;
        }
        .style-item-inner {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
          .style-icon {
            $icon-size: $style-item-size / 2;
            width: $icon-size;
            height: $icon-size;
            border-radius: 5px;
          }
          .voice-samples {
            display: flex;
            column-gap: 5px;
            align-items: center;
            justify-content: center;
          }
        }
      }
    }
  }
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

@media screen and (max-width: 700px) {
  .q-drawer-container {
    display: none;
  }
  .q-page-container {
    padding-left: unset !important;
    .q-page-sticky {
      left: 0 !important;
    }
  }
}
</style>
