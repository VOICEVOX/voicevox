<template>
  <QDialog
    v-model="isOpenComputed"
    maximized
    transitionShow="none"
    transitionHide="none"
    transitionDuration="100"
    class="default-style-select-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <div class="column">
            <QToolbarTitle class="text-display"
              >設定 / デフォルトスタイル・試聴 /
              {{ characterInfo.metas.speakerName }}</QToolbarTitle
            >
          </div>

          <QSpace />

          <div class="row items-center no-wrap">
            <QBtn
              unelevated
              :label="isModified ? '保存' : '戻る'"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap"
              @click="closeDialog"
            />
          </div>
        </QToolbar>
      </QHeader>

      <QDrawer
        bordered
        showIfAbove
        :modelValue="true"
        :width="$q.screen.width / 3"
        :breakpoint="0"
      >
        <div class="character-portrait-wrapper">
          <img :src="characterInfo.portraitPath" class="character-portrait" />
        </div>
      </QDrawer>

      <QPageContainer>
        <QPage>
          <div class="style-items-container">
            <div class="q-py-md">
              <QItem
                v-for="(style, styleIndex) of characterInfo.metas.styles"
                :key="styleIndex"
                v-ripple="isHoverableStyleItem"
                clickable
                class="q-pa-none style-item"
                :class="[
                  selectedStyleIndexComputed === styleIndex &&
                    'active-style-item',
                  isHoverableStyleItem && 'hoverable-style-item',
                ]"
                @click="selectStyleIndex(styleIndex)"
              >
                <div class="style-item-inner">
                  <img :src="style.iconPath" class="style-icon" />
                  <span class="text-subtitle1 q-ma-sm">{{
                    style.styleName || DEFAULT_STYLE_NAME
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
                      color="primary"
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
                              voiceSampleIndex,
                            )
                      "
                    />
                    <QRadio
                      class="absolute-top-right no-pointer-events text-primary"
                      :modelValue="selectedStyleIndexComputed"
                      :val="styleIndex"
                      @update:modelValue="selectStyleIndex(styleIndex)"
                    />
                  </div>
                </div>
              </QItem>
            </div>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStore } from "@/store";
import { DEFAULT_STYLE_NAME } from "@/store/utility";
import {
  CharacterInfo,
  DefaultStyleId,
  SpeakerId,
  StyleId,
  StyleInfo,
} from "@/type/preload";

const props = defineProps<{
  isOpen: boolean;
  selectedStyleIndex: number;
  characterInfo: CharacterInfo;
}>();

const emit = defineEmits<{
  (e: "update:isOpen", value: boolean): void;
  (e: "update:selectedStyleIndex", value: number): void;
}>();

const store = useStore();

const isOpenComputed = computed({
  get: () => props.isOpen,
  set: (val) => emit("update:isOpen", val),
});

const firstSelectedStyleIndex = ref(0);
const isModified = computed(() => {
  return firstSelectedStyleIndex.value !== props.selectedStyleIndex;
});

// ダイアログが開かれたときに初期値を求める
watch([() => props.isOpen], async ([newValue]) => {
  if (newValue) {
    firstSelectedStyleIndex.value = props.selectedStyleIndex;
  }
});

const selectedStyleIndexComputed = computed({
  get: () => props.selectedStyleIndex,
  set: (val) => {
    emit("update:selectedStyleIndex", val);
  },
});

const selectStyleIndex = (styleIndex: number) => {
  selectedStyleIndexComputed.value = styleIndex;

  // 音声を再生する。同じ話者/styleIndexだったら停止する。
  const selectedStyleInfo = props.characterInfo.metas.styles[styleIndex];
  if (
    playing.value != undefined &&
    playing.value.styleId === selectedStyleInfo.styleId
  ) {
    stop();
  } else {
    play(props.characterInfo.metas.speakerUuid, selectedStyleInfo, 0);
  }
};

const isHoverableStyleItem = ref(true);

const playing = ref<{ speakerUuid: string; styleId: StyleId; index: number }>();

const audio = new Audio();
audio.volume = 0.5;
audio.onended = () => stop();

const play = (
  speakerUuid: SpeakerId,
  { styleId, voiceSamplePaths }: StyleInfo,
  index: number,
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

// 既に設定が存在する場合があるので、新しい設定と既存設定を合成させる
const closeDialog = () => {
  const defaultStyleIds = JSON.parse(
    JSON.stringify(store.state.defaultStyleIds),
  ) as DefaultStyleId[];
  store.dispatch("SET_DEFAULT_STYLE_IDS", [
    ...defaultStyleIds.filter(
      (defaultStyleId) =>
        defaultStyleId.speakerUuid !== props.characterInfo.metas.speakerUuid,
    ),
    {
      speakerUuid: props.characterInfo.metas.speakerUuid,
      defaultStyleId:
        props.characterInfo.metas.styles[selectedStyleIndexComputed.value]
          .styleId,
      engineId:
        props.characterInfo.metas.styles[selectedStyleIndexComputed.value]
          .engineId,
    },
  ]);

  stop();
  isOpenComputed.value = false;
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

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
.q-page {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width}
  );
  overflow-y: scroll;

  > :deep(.scroll) {
    overflow-y: scroll;
    .q-tab-panel {
      padding: 5px 16px;
    }
  }

  .style-items-container {
    display: grid;
    align-items: center;
    height: calc(100% - 30px);
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
        box-shadow: 0 0 0 1px rgba(colors.$primary-rgb, 0.5);
        border-radius: 10px;
        overflow: hidden;
        &.active-style-item {
          box-shadow: 0 0 0 2px colors.$primary;
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
