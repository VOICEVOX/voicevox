<template>
  <div class="detail">
    <BaseScrollArea>
      <div class="inner">
        <h2 v-if="props.isNew" class="title">新しい単語の追加</h2>
        <h2 v-else class="title">単語の編集</h2>
        <div class="form-row">
          <h3 class="headline">単語</h3>
          <div>単語は全角と半角は区別しません。</div>
          <BaseTextField
            ref="surfaceInput"
            v-model="surface"
            ariaLabel="単語"
            :disabled="uiLocked"
            :hasError="surface.length === 0"
            @change="surface = convertHankakuToZenkaku(surface)"
            @enterkeydown="yomiInput?.focus()"
          >
            <template #error>単語は必須です。</template>
          </BaseTextField>
        </div>
        <div class="form-row">
          <h3 class="headline">読み</h3>
          <div>読みに使える文字はひらがなとカタカナのみです。</div>
          <BaseTextField
            ref="yomiInput"
            v-model="temporaryYomi"
            ariaLabel="読み"
            :disabled="uiLocked"
            :hasError="
              temporaryYomi.length === 0 || !isOnlyHiraOrKana(temporaryYomi)
            "
            @change="setYomi(temporaryYomi)"
          >
            <template v-if="temporaryYomi.length === 0" #error>
              読みは必須です。
            </template>
            <template v-else-if="!isOnlyHiraOrKana(temporaryYomi)" #error>
              ひらがなとカタカナ以外の文字が入力されています。
            </template>
          </BaseTextField>
        </div>
        <div class="form-row">
          <h3 class="headline">アクセント調整</h3>
          <div>
            語尾のアクセントを考慮するため、「が」が自動で挿入されます。
          </div>
          <div>
            <BaseButton
              :label="nowPlaying ? '停止' : '再生'"
              :disabled="uiLocked || nowGenerating || accentPhrase == undefined"
              :icon="nowPlaying ? 'stop' : 'play_arrow'"
              @click="nowPlaying ? stop() : play()"
            />
          </div>
          <div
            v-if="accentPhrase"
            :key="accentPhrase.moras.length"
            class="accent-phrase-table"
          >
            <BaseScrollArea>
              <div class="mora-table">
                <AudioAccent
                  :accentPhrase
                  :accentPhraseIndex="0"
                  :uiLocked
                  :onChangeAccent="changeAccent"
                />
                <template
                  v-for="(mora, moraIndex) in accentPhrase.moras"
                  :key="moraIndex"
                >
                  <div
                    class="text-cell"
                    :style="{
                      gridColumn: `${moraIndex * 2 + 1} / span 1`,
                    }"
                  >
                    {{ mora.text }}
                  </div>
                  <div
                    v-if="moraIndex < accentPhrase.moras.length - 1"
                    class="splitter-cell"
                    :style="{
                      gridColumn: `${moraIndex * 2 + 2} / span 1`,
                    }"
                  />
                </template>
              </div>
            </BaseScrollArea>
          </div>
        </div>
        <div class="form-row">
          <h3 class="headline">単語優先度</h3>
          <div>
            <div>
              単語を登録しても反映されない場合は優先度を高くしてください。
            </div>
            <div>
              高くしすぎると意図しない箇所にも反映されることがあります。
            </div>
          </div>
          <div>
            <BaseSlider
              v-model="wordPriority"
              :min="0"
              :max="10"
              :step="1"
              showStepMarkers
            />
            <div class="slider-label">
              <span>低い</span>
              <span>標準</span>
              <span>高い</span>
            </div>
          </div>
        </div>
      </div>
    </BaseScrollArea>
    <footer v-if="props.isNew" class="footer">
      <BaseButton :disabled="uiLocked" label="リセット" @click="resetInputs" />
      <BaseButton
        :disabled="uiLocked || !isValid"
        variant="primary"
        label="追加"
        @click="saveNewWord"
      />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { uiLocked } from "./common";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseSlider from "@/components/Base/BaseSlider.vue";
import BaseTextField from "@/components/Base/BaseTextField.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import AudioAccent from "@/components/Talk/AudioAccent.vue";
import {
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
} from "@/domain/japanese";
import type { AccentPhrase } from "@/openapi";
import { useStore } from "@/store";
import type { FetchAudioResult } from "@/store/type";
import { UnreachableError } from "@/type/utility";

const store = useStore();

const props = withDefaults(
  defineProps<{
    isNew?: boolean;
    initialSurface: string;
    initialYomi: string;
    initialWordPriority: number;
    initialAccentType: number;
  }>(),
  {
    isNew: false,
  },
);
const emit = defineEmits<{
  saveNewWord: [];
}>();

const surface = ref<string>(props.initialSurface);
const temporaryYomi = ref<string>(props.initialYomi);
const yomi = ref<string>(props.initialYomi);
const wordPriority = ref<number>(props.initialWordPriority);

const isValid = computed(() => {
  return (
    surface.value.length > 0 &&
    yomi.value.length > 0 &&
    isOnlyHiraOrKana(yomi.value) &&
    accentPhrase.value != undefined
  );
});

const computeRegisteredAccent = () => {
  if (accentPhrase.value == undefined)
    throw new UnreachableError("assert accentPhrase.value != undefined");
  const accent = accentPhrase.value.accent;
  return accent === accentPhrase.value.moras.length ? 0 : accent;
};

const computeDisplayAccent = () => {
  if (accentPhrase.value == undefined)
    throw new UnreachableError("assert accentPhrase.value != undefined");
  return props.initialAccentType === 0
    ? accentPhrase.value.moras.length
    : props.initialAccentType;
};

defineExpose({
  editState: computed(
    ():
      | {
          type: "invalid";
        }
      | {
          type: "unchanged";
        }
      | {
          type: "valid";
          surface: string;
          yomi: string;
          accentType: number;
          wordPriority: number;
        } => {
      const accentType =
        accentPhrase.value == undefined ? undefined : computeRegisteredAccent();
      if (
        props.isNew
          ? surface.value === "" && yomi.value === ""
          : surface.value === props.initialSurface &&
            yomi.value === props.initialYomi &&
            accentType === props.initialAccentType &&
            wordPriority.value === props.initialWordPriority
      ) {
        return { type: "unchanged" };
      }
      if (!isValid.value) {
        return { type: "invalid" };
      }
      return {
        type: "valid",
        surface: surface.value,
        yomi: yomi.value,
        accentType: computeRegisteredAccent(),
        wordPriority: wordPriority.value,
      };
    },
  ),
});

const voiceComputed = computed(() => {
  const userOrderedCharacterInfos =
    store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
  if (userOrderedCharacterInfos == undefined)
    throw new UnreachableError("assert USER_ORDERED_CHARACTER_INFOS");
  if (store.state.engineIds.length === 0)
    throw new UnreachableError("assert store.state.engineIds.length > 0");
  const characterInfo = userOrderedCharacterInfos[0].metas;
  const speakerId = characterInfo.speakerUuid;
  const { engineId, styleId } = characterInfo.styles[0];
  return { engineId, speakerId, styleId };
});

const kanaRegex = createKanaRegex();
const accentPhrase = ref<AccentPhrase | undefined>();
const nowGenerating = ref(false);
const nowPlaying = ref(false);
const surfaceInput = ref<typeof BaseTextField>();
const yomiInput = ref<typeof BaseTextField>();
let latestSetYomiRequest = 0;

const resetInputs = () => {
  surface.value = props.initialSurface;
  yomi.value = props.initialYomi;
  wordPriority.value = props.initialWordPriority;
  temporaryYomi.value = props.initialYomi;
  void setYomi(props.initialYomi);
};
const saveNewWord = () => {
  emit("saveNewWord");
};

const convertHankakuToZenkaku = (text: string) => {
  text = text.replace(/\p{Z}/gu, () => String.fromCharCode(0x3000));
  return text.replace(/[\u0021-\u007e]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0xfee0);
  });
};
onMounted(() => {
  surfaceInput.value?.focus();
  void setYomi(yomi.value);
});

function isOnlyHiraOrKana(text: string): boolean {
  return kanaRegex.test(text);
}

const setYomi = async (text: string) => {
  const requestId = ++latestSetYomiRequest;
  const { engineId, styleId } = voiceComputed.value;

  if (isOnlyHiraOrKana(text)) {
    const convertedYomi = convertLongVowel(convertHiraToKana(text));
    const newAccentPhrase = (
      await store.actions.FETCH_ACCENT_PHRASES({
        text: convertedYomi + "ガ'",
        engineId,
        styleId,
        isKana: true,
      })
    )[0];

    if (requestId !== latestSetYomiRequest) return;

    accentPhrase.value = newAccentPhrase;
    if (
      !props.isNew &&
      props.initialAccentType != undefined &&
      props.initialYomi === convertedYomi
    ) {
      accentPhrase.value.accent = computeDisplayAccent();
    }
    if (yomi.value !== convertedYomi) {
      yomi.value = convertedYomi;
    }
    return;
  }

  accentPhrase.value = undefined;
};

const play = async () => {
  if (accentPhrase.value == undefined) return;

  nowGenerating.value = true;
  const audioItem = await store.actions.GENERATE_AUDIO_ITEM({
    text: yomi.value,
    voice: voiceComputed.value,
  });

  if (audioItem.query == undefined)
    throw new Error(`assert audioItem.query !== undefined`);

  audioItem.query.accentPhrases = [accentPhrase.value];

  let fetchAudioResult: FetchAudioResult;
  try {
    fetchAudioResult = await store.actions.FETCH_AUDIO_FROM_AUDIO_ITEM({
      audioItem,
    });
  } catch (e) {
    window.backend.logError(e);
    nowGenerating.value = false;
    void store.actions.SHOW_ALERT_DIALOG({
      title: "生成に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    return;
  }

  const { blob } = fetchAudioResult;
  nowGenerating.value = false;
  nowPlaying.value = true;
  await store.actions.PLAY_AUDIO_BLOB({ audioBlob: blob });
  nowPlaying.value = false;
};

const stop = () => {
  void store.actions.STOP_AUDIO();
};

const changeAccent = async (_: number, accent: number) => {
  const { engineId, styleId } = voiceComputed.value;

  if (accentPhrase.value == undefined) return;

  accentPhrase.value.accent = accent;
  accentPhrase.value = (
    await store.actions.FETCH_MORA_DATA({
      accentPhrases: [accentPhrase.value],
      engineId,
      styleId,
    })
  )[0];
};
</script>

<style lang="scss" scoped>
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;

.detail {
  display: flex;
  flex-flow: column;
  height: 100%;
}

.inner {
  min-height: 100%;
  max-width: 960px;
  margin: auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: vars.$padding-2;
  gap: vars.$gap-2;
}

.title {
  @include mixin.headline-1;
  word-break: break-all;
}

.form-row {
  display: flex;
  flex-flow: column;
  gap: vars.$gap-1;
}

.headline {
  @include mixin.headline-2;
}

.accent-phrase-table {
  display: flex;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-2;

  .mora-table {
    display: inline-grid;
    align-self: stretch;
    grid-template-rows: 20px 60px 30px;
    padding: vars.$padding-2;

    .text-cell {
      padding: 0;
      min-width: 20px;
      max-width: 20px;
      grid-row-start: 3;
      text-align: center;
      white-space: nowrap;
      color: colors.$display;
      position: relative;
    }

    .splitter-cell {
      min-width: 20px;
      max-width: 20px;
      grid-row: 3 / span 1;
    }
  }
}

.slider-label {
  display: flex;
  justify-content: space-between;
}

.footer {
  padding: vars.$padding-2;
  display: flex;
  flex: 1;
  justify-content: flex-end;
  gap: vars.$gap-1;
}
</style>
