<template>
  <QDialog
    v-model="dialogOpened"
    maximized
    transitionShow="none"
    transitionHide="none"
    transitionDuration="100"
    class="default-style-select-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <QToolbarTitle class="text-display"
            >設定 / キャラクター＆スタイルの管理 /
            {{ characterInfo.metas.speakerName }}</QToolbarTitle
          >

          <QSpace />

          <QBtn
            unelevated
            label="戻る"
            color="toolbar-button"
            textColor="toolbar-button-display"
            class="text-no-wrap"
            @click="closeDialog"
          />
        </QToolbar>
      </QHeader>

      <QPageContainer>
        <QPage>
          <div class="container">
            <img :src="characterInfo.portraitPath" class="character-portrait" />
            <BaseScrollArea>
              <div class="inner">
                <div class="character-detail">
                  <h1 class="character-name">
                    {{ characterInfo.metas.speakerName }}
                  </h1>
                  <section class="section">
                    <h2 class="headline">デフォルトスタイル</h2>
                    <div>
                      デフォルトスタイル：{{
                        characterInfo.metas.styles[selectedStyleIndex].styleName
                      }}
                    </div>
                    <div class="style-grid">
                      <!-- TODO: Button in Buttonなデザインになっているのを変更する -->
                      <button
                        v-for="(style, styleIndex) of talkStyles"
                        :key="styleIndex"
                        clickable
                        class="q-pa-none style-item"
                        :class="[
                          selectedStyleIndex === styleIndex &&
                            'active-style-item',
                          isHoverableStyleItem && 'hoverable-style-item',
                        ]"
                        @click="selectStyleIndex(styleIndex)"
                      >
                        <QRadio
                          class="style-radio"
                          :modelValue="selectedStyleIndex"
                          :val="styleIndex"
                          @update:modelValue="selectStyleIndex(styleIndex)"
                        />
                        <img :src="style.iconPath" class="style-icon" />
                        <span class="style-name">{{
                          style.styleName || DEFAULT_STYLE_NAME
                        }}</span>
                        <div class="voice-samples">
                          <BaseIconButton
                            v-for="voiceSampleIndex of [...Array(3).keys()]"
                            :key="voiceSampleIndex"
                            :icon="
                              playing != undefined &&
                              characterInfo.metas.speakerUuid ===
                                playing.speakerUuid &&
                              style.styleId === playing.styleId &&
                              voiceSampleIndex === playing.index
                                ? 'stop'
                                : 'play_arrow'
                            "
                            :label="`サンプルボイス${voiceSampleIndex + 1}`"
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
                        </div>
                      </button>
                    </div>
                  </section>
                  <section class="section">
                    <h2 class="headline">利用規約</h2>
                    <BaseDocumentView class="character-policy">
                      <!-- eslint-disable-next-line vue/no-v-html -->
                      <div v-html="policyHtml"></div>
                    </BaseDocumentView>
                  </section>
                </div>
              </div>
            </BaseScrollArea>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseDocumentView from "@/components/Base/BaseDocumentView.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";
import { useStore } from "@/store";
import { DEFAULT_STYLE_NAME } from "@/store/utility";
import {
  CharacterInfo,
  DefaultStyleId,
  SpeakerId,
  StyleId,
  StyleInfo,
} from "@/type/preload";
import { debounce } from "@/helpers/timer";

const dialogOpened = defineModel<boolean>({ default: false });

const props = defineProps<{
  characterInfo: CharacterInfo;
}>();

const store = useStore();

const selectedStyleIndex = ref<number>(0);

const talkStyles = computed(() =>
  props.characterInfo.metas.styles.filter(
    (style) => style.styleType === "talk",
  ),
);

// ダイアログが開かれたときに初期値を求める
watch([dialogOpened], async ([newValue]) => {
  if (!newValue) return;

  const defaultStyle = store.state.defaultStyleIds.find(
    (defaultStyleId) =>
      defaultStyleId.speakerUuid === props.characterInfo.metas.speakerUuid,
  );

  if (defaultStyle == undefined) {
    selectedStyleIndex.value = 0;
    return;
  }

  selectedStyleIndex.value = props.characterInfo.metas.styles.findIndex(
    (style) => style.styleId === defaultStyle.defaultStyleId,
  );
});

const saveDefaultStyle = debounce((styleIndex: number) => {
  // 既に設定が存在する場合があるので、新しい設定と既存設定を合成させる
  const defaultStyleIds = JSON.parse(
    JSON.stringify(store.state.defaultStyleIds),
  ) as DefaultStyleId[];
  void store.actions.SET_DEFAULT_STYLE_IDS([
    ...defaultStyleIds.filter(
      (defaultStyleId) =>
        defaultStyleId.speakerUuid !== props.characterInfo.metas.speakerUuid,
    ),
    {
      speakerUuid: props.characterInfo.metas.speakerUuid,
      defaultStyleId: props.characterInfo.metas.styles[styleIndex].styleId,
      engineId: props.characterInfo.metas.styles[styleIndex].engineId,
    },
  ]);
}, 300);

const selectStyleIndex = (styleIndex: number) => {
  if (selectedStyleIndex.value !== styleIndex) {
    saveDefaultStyle(styleIndex);
  }

  selectedStyleIndex.value = styleIndex;

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
  void audio.play();
  playing.value = { speakerUuid, styleId, index };
};
const stop = () => {
  if (audio.src === "") return;

  audio.pause();
  audio.removeAttribute("src");
  playing.value = undefined;
};

const md = useMarkdownIt();

const policyHtml = computed(() => {
  return md.render(props.characterInfo.metas.policy);
});

const closeDialog = () => {
  stop();
  dialogOpened.value = false;
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.q-toolbar div:first-child {
  min-width: 0;
}

.container {
  // TODO: 親コンポーネントからheightを取得できないため一時的にcalcを使用、Dialogの構造を再設計後100%に変更する
  // height: 100%;
  height: calc(100vh - 90px);
  background-color: colors.$background;
  display: grid;
  grid-template-columns: 33vw 1fr;
  gap: vars.$gap-2;
}

.inner {
  padding: vars.$padding-2;
}

.character-detail {
  max-width: 960px;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: vars.$gap-2;
}

.character-portrait {
  height: auto;
  max-height: 80vh;
  width: 100%;
  margin: auto;
  object-fit: contain;
}

.character-name {
  @include mixin.headline-1;
}

.section {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
}

.headline {
  @include mixin.headline-2;
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  column-gap: 10px;
  row-gap: 10px;
}

.style-item {
  display: grid;
  grid-template-columns: auto auto 1fr;
  place-items: center;
  grid-template-rows: auto auto;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
  color: colors.$display;
  border-radius: vars.$radius-2;
  padding: vars.$padding-1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: pointer;
  position: relative;

  &:hover {
    background-color: colors.$control-hovered;
  }

  &:active {
    background-color: colors.$control-pressed;
    box-shadow: 0 0 0 transparent;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }

  &:disabled {
    opacity: 0.5;
  }

  .style-radio {
    grid-column: 1 / 2;
    grid-row: 1 / 3;
  }

  .style-icon {
    grid-column: 2 / 3;
    grid-row: 1 / 3;
    $icon-size: 64px;
    width: $icon-size;
    height: $icon-size;
    border-radius: vars.$radius-1;
  }

  .style-name {
    text-align: left;
    font-weight: 600;
  }

  .voice-samples {
    display: flex;
  }
}

.character-policy {
  line-height: 1.75;
  padding: vars.$padding-2;
  border-radius: vars.$radius-2;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

@media screen and (max-width: 700px) {
  .container {
    grid-template-columns: 1fr;
  }

  .character-portrait {
    display: none;
  }
}
</style>
