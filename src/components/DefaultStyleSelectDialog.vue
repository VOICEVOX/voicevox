<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="default-style-select-dialog"
    v-model="modelValueComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title
              v-if="isFirstTime && showCharacterInfos.length > 0"
              class="text-display text-h6"
              >「{{ showCharacterInfos[pageIndex].metas.speakerName }}」の{{
                showCharacterInfos[pageIndex].metas.styles.length > 1
                  ? "デフォルトのスタイル（喋り方）を選んでください"
                  : "サンプル音声を視聴できます"
              }}
            </q-toolbar-title>
            <q-toolbar-title v-else class="text-display"
              >設定 / デフォルトスタイル・試聴</q-toolbar-title
            >
            <span
              v-if="
                isFirstTime &&
                showCharacterInfos.length > 0 &&
                showCharacterInfos[pageIndex].metas.styles.length > 1
              "
              class="text-display text-caption q-ml-sm"
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
              color="background-light"
              text-color="display-dark"
              class="text-no-wrap q-mr-md"
              @click="prevPage"
            />

            <div class="text-subtitle2 text-no-wrap text-display q-mr-md">
              {{ pageIndex + 1 }} / {{ showCharacterInfos.length }}
            </div>

            <q-btn
              v-if="pageIndex + 1 < showCharacterInfos.length"
              unelevated
              label="次へ"
              color="background-light"
              text-color="display-dark"
              class="text-no-wrap"
              :disable="!canNext"
              @click="nextPage"
            />
            <q-btn
              v-else
              unelevated
              label="完了"
              color="background-light"
              text-color="display-dark"
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
            v-if="showCharacterInfos.length > 0"
            :src="showCharacterInfos[pageIndex].portraitPath"
            class="character-portrait"
          />
        </div>
      </q-drawer>

      <q-page-container>
        <q-page v-if="showCharacterInfos && selectedStyleIndexes">
          <q-tab-panels v-model="pageIndex">
            <q-tab-panel
              v-for="(characterInfo, characterIndex) of showCharacterInfos"
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
                          color="primary-light"
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
import { CharacterInfo, DefaultStyleId, StyleInfo } from "@/type/preload";

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

    // アップデートで増えたキャラ・スタイルがあれば、それらに対して起動時にデフォルトスタイル選択・試聴を問うための変数
    // その他の場合は、characterInfosと同じになる
    const showCharacterInfos = ref(props.characterInfos);

    const isFirstTime = ref(false);
    const selectedStyleIndexes = ref<(number | undefined)[]>([]);

    // ダイアログが開かれたときに初期値を求める
    watch(
      () => props.modelValue,
      async (newValue, oldValue) => {
        if (!oldValue && newValue) {
          showCharacterInfos.value = [];
          selectedStyleIndexes.value = await Promise.all(
            props.characterInfos.map(async (info) => {
              const styles = info.metas.styles;
              const isUnsetDefaultStyleId = await store.dispatch(
                "IS_UNSET_DEFAULT_STYLE_ID",
                { speakerUuid: info.metas.speakerUuid }
              );
              if (isUnsetDefaultStyleId) {
                isFirstTime.value = true;
                showCharacterInfos.value.push(info);
                return undefined;
              }

              const defaultStyleId = store.state.defaultStyleIds.find(
                (x) => x.speakerUuid === info.metas.speakerUuid
              )?.defaultStyleId;

              const index = styles.findIndex(
                (style) => style.styleId === defaultStyleId
              );
              return index === -1 ? undefined : index;
            })
          );
          if (!isFirstTime.value) {
            showCharacterInfos.value = props.characterInfos;
          } else {
            selectedStyleIndexes.value = showCharacterInfos.value.map(
              (info) => {
                if (info.metas.styles.length > 1) {
                  return undefined;
                } else {
                  return info.metas.styles[0].styleId;
                }
              }
            );
          }
        }
      }
    );

    const selectStyleIndex = (characterIndex: number, styleIndex: number) => {
      selectedStyleIndexes.value[characterIndex] = styleIndex;

      // 音声を再生する。同じstyleIndexだったら停止する。
      const selectedStyleInfo =
        showCharacterInfos.value[characterIndex].metas.styles[styleIndex];
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
      const defaultStyleIds = JSON.parse(
        JSON.stringify(store.state.defaultStyleIds)
      ) as DefaultStyleId[];
      showCharacterInfos.value.forEach((info, idx) => {
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
      isFirstTime.value = false;

      stop();
      modelValueComputed.value = false;
      pageIndex.value = 0;
    };

    return {
      modelValueComputed,
      showCharacterInfos,
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
        box-shadow: 0 0 0 1px rgba(var(--color-primary-light-rgb), 0.5);
        border-radius: 10px;
        overflow: hidden;
        &.active-style-item {
          box-shadow: 0 0 0 2px var(--color-primary-light);
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
