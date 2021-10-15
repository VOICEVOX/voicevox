<template>
  <q-dialog
    maximized
    seamless
    transition-show="none"
    transition-hide="none"
    class="default-style-select-dialog"
    v-model="modelValueComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-white">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="flex items-end">
            <q-toolbar-title class="text-secondary"
              >デフォルトのスタイルを選択してください</q-toolbar-title
            >
            <span class="text-secondary text-caption q-ml-sm">
              ※後からでも変更できます
            </span>
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
        <div class="column full-height">
          <img
            :src="
              characterInfos &&
              getBlobUrl(characterInfos[pageIndex].portraitBlob)
            "
            class="full-width full-height character-portrait"
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
                  class="q-mb-md q-pa-none style-item"
                  :class="
                    selectedStyleIndexes[characterIndex] === styleIndex &&
                    'active-style-item'
                  "
                >
                  <img
                    :src="getBlobUrl(characterInfo.iconBlob)"
                    class="style-icon"
                  />
                  <q-item-section>
                    <q-item-label class="text-subtitle1 q-ma-md">{{
                      style.styleName || "ノーマル"
                    }}</q-item-label>
                    <q-item-label class="q-ml-lg voice-samples">
                      <span class="text-caption">音声サンプル</span>
                      <div class="flex q-gutter-xs">
                        <q-btn
                          v-for="(voiceSample, index) of voiceSamples"
                          :key="index"
                          round
                          outline
                          icon="play_arrow"
                          color="primary"
                          class="voice-sample-btn"
                          @click="play"
                        />
                      </div>
                    </q-item-label>
                    <div class="absolute" style="top: 0; right: 0">
                      <q-radio
                        v-model="selectedStyleIndexes[characterIndex]"
                        :val="styleIndex"
                      />
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>
          </q-tab-panels>

          <q-page-sticky expand position="bottom">
            <q-toolbar class="bg-primary">
              <div class="text-subtitle1 text-no-wrap q-mr-sm">
                {{ pageIndex + 1 }} / {{ characterInfos.length }}
              </div>

              <q-space />

              <q-btn
                unelevated
                label="戻る"
                color="white"
                text-color="secondary"
                class="text-no-wrap q-mr-sm"
                :disable="pageIndex < 1"
                @click="pageIndex--"
              />

              <q-btn
                v-if="pageIndex + 1 < characterInfos.length"
                unelevated
                label="次へ"
                color="white"
                text-color="secondary"
                class="text-no-wrap"
                @click="pageIndex++"
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
            </q-toolbar>
          </q-page-sticky>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch } from "vue";
import { useStore } from "@/store";

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

    const characterInfos = computed(() => store.state.characterInfos);

    const selectedStyleIndexes = ref<number[]>();
    watch(characterInfos, () => {
      selectedStyleIndexes.value = characterInfos.value?.map((info) =>
        info.metas.styles.findIndex(
          (style) => style.styleId === info.metas.defaultStyleId
        )
      );
    });

    const pageIndex = ref(0);

    // TODO: 仮
    const voiceSamples = ref([...Array(3).keys()]);

    const getBlobUrl = (blob: Blob) => {
      return URL.createObjectURL(blob);
    };

    const play = () => {
      // TODO: 再生処理
    };

    const closeDialog = () => {
      if (!characterInfos.value) return;

      const defaultStyleIds = characterInfos.value.map((info, idx) => {
        return {
          speakerUuid: info.metas.speakerUuid,
          defaultStyleId:
            info.metas.styles[selectedStyleIndexes.value?.[idx] || 0].styleId,
        };
      });
      store.dispatch("SET_DEFAULT_STYLE_IDS", defaultStyleIds);

      modelValueComputed.value = false;
    };

    return {
      modelValueComputed,
      characterInfos,
      selectedStyleIndexes,
      pageIndex,
      voiceSamples,
      getBlobUrl,
      play,
      closeDialog,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

$bottombar-height: 50px - global.$window-border-width;

.character-portrait {
  object-fit: none;
  object-position: center top;
}
.q-tab-panels {
  height: calc(
    100vh - #{global.$menubar-height + global.$header-height +
      global.$window-border-width + $bottombar-height}
  );
  overflow-y: auto;

  .style-item {
    box-shadow: 0 0 0 1px rgba(global.$primary, 0.5);
    border-radius: 10px;
    overflow: hidden;
    &.active-style-item {
      box-shadow: 0 0 0 2px global.$primary;
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
.q-page-sticky {
  bottom: -#{global.$window-border-width};
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
  .style-icon {
    width: 80px !important;
    height: 80px !important;
  }
  .voice-sample-btn {
    font-size: 8px;
  }
}
</style>
