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
            <q-toolbar-title v-if="isFirstTime" class="text-secondary"
              >デフォルトのスタイルを選択してください</q-toolbar-title
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
            <div class="text-subtitle1 text-no-wrap text-secondary q-mr-md">
              {{ pageIndex + 1 }} / {{ characterInfos.length }}
            </div>

            <q-btn
              unelevated
              label="戻る"
              color="white"
              text-color="secondary"
              class="text-no-wrap q-mr-sm"
              :disable="pageIndex < 1"
              @click="prevPage"
            />

            <q-btn
              v-if="pageIndex + 1 < characterInfos.length"
              unelevated
              label="次へ"
              color="white"
              text-color="secondary"
              class="text-no-wrap"
              @click="nextPage"
            />
            <q-btn
              v-else
              unelevated
              label="完了"
              color="white"
              text-color="secondary"
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
              <span class="text-h6">{{ characterInfo.metas.speakerName }}</span>

              <q-list class="q-mt-md q-pb-sm">
                <q-item
                  v-for="(style, styleIndex) of characterInfo.metas.styles"
                  :key="styleIndex"
                  v-ripple="isHoverableStyleItem"
                  clickable
                  class="q-mb-md q-pa-none style-item"
                  :class="[
                    selectedStyleIndexes[characterIndex] === styleIndex &&
                      'active-style-item',
                    isHoverableStyleItem && 'hoverable-style-item',
                  ]"
                  @click="selectedStyleIndexes[characterIndex] = styleIndex"
                >
                  <img :src="style.iconPath" class="style-icon" />
                  <q-item-section>
                    <q-item-label class="text-subtitle1 q-ma-md">{{
                      style.styleName || "ノーマル"
                    }}</q-item-label>
                    <q-item-label class="q-ml-lg voice-samples">
                      <span class="text-caption">音声サンプル</span>
                      <div class="flex q-gutter-xs">
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
                      </div>
                    </q-item-label>
                    <q-radio
                      class="absolute-top-right no-pointer-events"
                      v-model="selectedStyleIndexes[characterIndex]"
                      :val="styleIndex"
                    />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>
          </q-tab-panels>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from "vue";
import { useStore } from "@/store";
import { StyleInfo } from "@/type/preload";

export default defineComponent({
  name: "DefaultStyleSelectDialog",

  props: {
    modelValue: {
      type: Boolean,
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
    store
      .dispatch("IS_UNSET_DEFAULT_STYLE_IDS")
      .then((isUnsetDefaultStyleIds) => {
        isFirstTime.value = isUnsetDefaultStyleIds;
      });

    const characterInfos = computed(() => store.state.characterInfos);

    const selectedStyleIndexes = ref(
      characterInfos.value?.map((info) => {
        const defaultStyleId = store.state.defaultStyleIds.find(
          (x) => x.speakerUuid === info.metas.speakerUuid
        )?.defaultStyleId;

        return info.metas.styles.findIndex(
          (style) => style.styleId === defaultStyleId
        );
      })
    );

    const pageIndex = ref(0);

    const isHoverableStyleItem = ref(true);

    const playing = ref<{ styleId: number; index: number }>();

    const audio = new Audio();
    audio.volume = 0.7;
    audio.onended = () => stop();

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
      if (!characterInfos.value) return;

      const defaultStyleIds = characterInfos.value.map((info, idx) => ({
        speakerUuid: info.metas.speakerUuid,
        defaultStyleId:
          info.metas.styles[selectedStyleIndexes.value?.[idx] ?? 0].styleId,
      }));
      store.dispatch("SET_DEFAULT_STYLE_IDS", defaultStyleIds);

      stop();
      modelValueComputed.value = false;
      pageIndex.value = 0;
    };

    return {
      modelValueComputed,
      isFirstTime,
      characterInfos,
      selectedStyleIndexes,
      pageIndex,
      isHoverableStyleItem,
      playing,
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
  }

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
    .style-icon {
      width: 100px;
      height: 100px;
    }
    .voice-samples {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      justify-items: center;
      margin-top: 0;
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

@media screen and (max-width: 400px) {
  .q-btn {
    padding: 0 5px;
  }
  .style-icon {
    width: 80px !important;
    height: 80px !important;
  }
  .voice-sample-btn {
    font-size: 8px;
  }
}
</style>
