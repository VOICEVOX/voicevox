<template>
  <q-dialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="default-style-select-dialog transparent-backdrop"
    v-model="isOpenComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title class="text-display"
              >設定 / デフォルトスタイル・試聴 /
              {{ characterInfo.metas.speakerName }}</q-toolbar-title
            >
          </div>

          <q-space />

          <div class="row items-center no-wrap">
            <q-btn
              unelevated
              label="完了"
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap"
              @click="closeDialog"
            />
          </div>
        </q-toolbar>
      </q-header>

      <q-drawer
        bordered
        show-if-above
        :model-value="true"
        :width="$q.screen.width / 3"
        :breakpoint="0"
      >
        <div class="character-portrait-wrapper">
          <img :src="characterInfo.portraitPath" class="character-portrait" />
        </div>
      </q-drawer>

      <q-page-container>
        <q-page>
          <div class="style-items-container">
            <div class="q-pb-md">
              <q-item
                v-for="(style, styleIndex) of characterInfo.metas.styles"
                :key="styleIndex"
                clickable
                v-ripple="isHoverableStyleItem"
                class="q-pa-none style-item"
                :class="[
                  selectedStyleIndexComputed === styleIndex &&
                    'active-style-item',
                  isHoverableStyleItem && 'hoverable-style-item',
                ]"
                @click="selectStyleIndex(styleIndex)"
                @dblclick="closeDialog"
              >
                <div class="style-item-inner">
                  <img :src="style.iconPath" class="style-icon" />
                  <span class="text-subtitle1 q-ma-sm">{{
                    style.styleName || "ノーマル"
                  }}</span>
                  <div class="voice-samples">
                    <q-btn
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
                    <q-radio
                      class="
                        absolute-top-right
                        no-pointer-events
                        text-primary-light
                      "
                      :model-value="selectedStyleIndexComputed"
                      :val="styleIndex"
                      @update:model-value="selectStyleIndex(styleIndex)"
                    />
                  </div>
                </div>
              </q-item>
            </div>
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, PropType } from "vue";
import { useStore } from "@/store";
import { CharacterInfo, DefaultStyleId, StyleInfo } from "@/type/preload";

export default defineComponent({
  name: "DefaultStyleSelectDialog",

  props: {
    isOpen: {
      type: Boolean,
      required: true,
    },
    selectedStyleIndex: {
      type: Number,
      required: true,
    },
    characterInfo: {
      type: Object as PropType<CharacterInfo>,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();

    const isOpenComputed = computed({
      get: () => props.isOpen,
      set: (val) => emit("update:isOpen", val),
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
        playing.value !== undefined &&
        playing.value.styleId === selectedStyleInfo.styleId
      ) {
        stop();
      } else {
        play(props.characterInfo.metas.speakerUuid, selectedStyleInfo, 0);
      }
    };

    const isHoverableStyleItem = ref(true);

    const playing =
      ref<{ speakerUuid: string; styleId: number; index: number }>();

    const audio = new Audio();
    audio.volume = 0.5;
    audio.onended = () => stop();

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

    // 既に設定が存在する場合があるので、新しい設定と既存設定を合成させる
    const closeDialog = () => {
      const defaultStyleIds = JSON.parse(
        JSON.stringify(store.state.defaultStyleIds)
      ) as DefaultStyleId[];
      store.dispatch("SET_DEFAULT_STYLE_IDS", [
        ...defaultStyleIds,
        {
          speakerUuid: props.characterInfo.metas.speakerUuid,
          defaultStyleId:
            props.characterInfo.metas.styles[selectedStyleIndexComputed.value]
              .styleId,
        },
      ]);

      stop();
      isOpenComputed.value = false;
    };

    return {
      isOpenComputed,
      selectedStyleIndexComputed,
      selectStyleIndex,
      isHoverableStyleItem,
      playing,
      play,
      stop,
      closeDialog,
    };
  },
});
</script>

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
.q-page {
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
