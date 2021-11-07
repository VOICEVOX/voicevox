<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="default-style-select-dialog"
    v-model="modelValueComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-white">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title v-if="isFirstTime" class="text-secondary text-h6"
              >「{{
                characterInfos[pageIndex].metas.speakerName
              }}」のデフォルトのスタイル（喋り方）を選んでください</q-toolbar-title
            >
            <q-toolbar-title v-else class="text-secondary"
              >設定 / デフォルトスタイル</q-toolbar-title
            >
            <span
              v-if="isFirstTime"
              class="text-secondary text-caption q-ml-sm"
            >
              ※後からでも変更できます
            </span>
          </div>

          <q-space />

          <div class="row items-center no-wrap">
            <q-btn
              v-show="pageIndex >= 1"
              unelevated
              label="戻る"
              color="white"
              text-color="secondary"
              class="text-no-wrap q-mr-md"
              @click="prevPage"
            />

            <div class="text-subtitle2 text-no-wrap text-secondary q-mr-md">
              {{ pageIndex + 1 }} / {{ characterInfos.length }}
            </div>

            <q-btn
              v-if="pageIndex + 1 < characterInfos.length"
              unelevated
              label="次へ"
              color="white"
              text-color="secondary"
              class="text-no-wrap"
              :disable="!canNext"
              @click="nextPage"
            />
            <q-btn
              v-else
              unelevated
              label="完了"
              color="white"
              text-color="secondary"
              class="text-no-wrap"
              :disable="!canNext"
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
          <img
            :src="characterInfos[pageIndex].portraitPath"
            class="character-portrait"
          />
        </div>
      </q-drawer>

      <q-page-container>
        <q-page v-if="characterInfos && selectedStyleIndexes">
          <q-tab-panels v-model="pageIndex">
            <q-tab-panel
              v-for="(characterInfo, characterIndex) of characterInfos"
              :key="characterIndex"
              :name="characterIndex"
            >
              <div class="text-h6 character-name">
                {{ characterInfo.metas.speakerName }}
              </div>

              <div class="style-items-container">
                <div class="q-pb-md">
                  <q-item
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
                        <q-btn
                          v-for="voiceSampleIndex of [...Array(3).keys()]"
                          :key="voiceSampleIndex"
                          round
                          outline
                          :icon="
                            style.styleId === playing?.styleId &&
                            voiceSampleIndex === playing.index
                              ? 'stop'
                              : 'play_arrow'
                          "
                          color="primary"
                          class="voice-sample-btn"
                          @mouseenter="isHoverableStyleItem = false"
                          @mouseleave="isHoverableStyleItem = true"
                          @click.stop="
                            style.styleId === playing?.styleId &&
                            voiceSampleIndex === playing.index
                              ? stop()
                              : play(style, voiceSampleIndex)
                          "
                        />
                        <q-radio
                          class="absolute-top-right no-pointer-events"
                          :model-value="selectedStyleIndexes[characterIndex]"
                          :val="styleIndex"
                          @update:model-value="
                            selectStyleIndex(characterIndex, styleIndex)
                          "
                        />
                      </div>
                    </div>
                  </q-item>
                </div>
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, PropType, watch } from "vue";
import { useStore } from "@/store";
import { CharacterInfo, StyleInfo } from "@/type/preload";

export default defineComponent({
  name: "DefaultStyleSelectDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    characterInfos: {
      type: Object as PropType<CharacterInfo[]>,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();

    const modelValueComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const isFirstTime = ref(false);
    const selectedStyleIndexes = ref<(number | undefined)[]>([]);

    // ダイアログが開かれたときに初期値を求める
    watch(
      () => props.modelValue,
      async (newValue, oldValue) => {
        if (!oldValue && newValue) {
          const isUnsetDefaultStyleIds = await store.dispatch(
            "IS_UNSET_DEFAULT_STYLE_IDS"
          );
          isFirstTime.value = isUnsetDefaultStyleIds;

          selectedStyleIndexes.value = props.characterInfos.map((info) => {
            // FIXME: キャラクターごとにデフォルスタイル選択済みか保存できるようになるべき
            if (isFirstTime.value) return undefined;

            const defaultStyleId = store.state.defaultStyleIds.find(
              (x) => x.speakerUuid === info.metas.speakerUuid
            )?.defaultStyleId;

            const index = info.metas.styles.findIndex(
              (style) => style.styleId === defaultStyleId
            );
            return index === -1 ? undefined : index;
          });
        }
      }
    );

    const selectStyleIndex = (characterIndex: number, styleIndex: number) => {
      selectedStyleIndexes.value[characterIndex] = styleIndex;

      // 音声を再生する。同じstyleIndexだったら停止する。
      const selectedStyleInfo =
        props.characterInfos[characterIndex].metas.styles[styleIndex];
      if (
        playing.value !== undefined &&
        playing.value.styleId === selectedStyleInfo.styleId
      ) {
        stop();
      } else {
        play(selectedStyleInfo, 0);
      }
    };

    const pageIndex = ref(0);

    const isHoverableStyleItem = ref(true);

    const playing = ref<{ styleId: number; index: number }>();

    const audio = new Audio();
    audio.volume = 0.5;
    audio.onended = () => stop();

    const canNext = computed(() => {
      const selectedStyleIndex = selectedStyleIndexes.value[pageIndex.value];
      return selectedStyleIndex !== undefined;
    });

    const play = ({ styleId, voiceSamplePaths }: StyleInfo, index: number) => {
      if (audio.src !== "") stop();

      audio.src = voiceSamplePaths[index];
      audio.play();
      playing.value = { styleId, index };
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

    const closeDialog = () => {
      const defaultStyleIds = props.characterInfos.map((info, idx) => ({
        speakerUuid: info.metas.speakerUuid,
        defaultStyleId:
          info.metas.styles[selectedStyleIndexes.value[idx] ?? 0].styleId,
      }));
      store.dispatch("SET_DEFAULT_STYLE_IDS", defaultStyleIds);

      stop();
      modelValueComputed.value = false;
      pageIndex.value = 0;
    };

    return {
      modelValueComputed,
      isFirstTime,
      selectedStyleIndexes,
      selectStyleIndex,
      pageIndex,
      isHoverableStyleItem,
      playing,
      canNext,
      play,
      stop,
      prevPage,
      nextPage,
      closeDialog,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

.q-toolbar div:first-child {
  min-width: 0;
}
.character-portrait-wrapper {
  display: grid;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  .character-portrait {
    object-fit: none;
    object-position: center top;
    width: 100%;
    height: fit-content;
  }
}
.q-tab-panels {
  height: calc(
    100vh - #{global.$menubar-height + global.$header-height +
      global.$window-border-width}
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
        box-shadow: 0 0 0 1px rgba(global.$primary, 0.5);
        border-radius: 10px;
        overflow: hidden;
        &.active-style-item {
          box-shadow: 0 0 0 2px global.$primary;
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
