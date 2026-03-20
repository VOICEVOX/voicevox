<template>
  <div v-show="wordEditing" class="detail">
    <BaseScrollArea>
      <div class="inner">
        <h2 class="title">
          {{ selectedId ? userDict[selectedId].surface : "新しい単語の追加" }}
        </h2>
        <div class="form-row">
          <h3 class="headline">単語</h3>
          <div>単語は全角と半角は区別しません。</div>
          <BaseTextField
            ref="surfaceInput"
            v-model="surface"
            :disabled="uiLocked"
            @change="
              () => {
                setSurface(surface);
                saveWord();
              }
            "
            @keydown.enter="yomiInput?.focus()"
          />
        </div>
        <div class="form-row">
          <h3 class="headline">読み</h3>
          <div>読みに使える文字はひらがなとカタカナのみです。</div>
          <BaseTextField
            ref="yomiInput"
            v-model="yomi"
            :disabled="uiLocked"
            :hasError="!isOnlyHiraOrKana"
            @change="
              async () => {
                await setYomi(yomi);
                saveWord();
              }
            "
          >
            <template #error>
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
              :disabled="nowGenerating"
              :icon="nowPlaying ? 'stop' : 'play_arrow'"
              @click="nowPlaying ? stop() : play()"
            />
          </div>
          <div
            v-if="accentPhrase"
            :key="accentPhrase?.moras.length"
            class="accent-phrase-table"
          >
            <BaseScrollArea>
              <div class="mora-table">
                <AudioAccent
                  :accentPhrase
                  :accentPhraseIndex="0"
                  :uiLocked
                  :onChangeAccent="
                    async (accentPhraseIndex: number, accent: number) => {
                      await changeAccent(accentPhraseIndex, accent);
                      saveWord();
                    }
                  "
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
            単語を登録しても反映されない場合は優先度を高くしてください。
          </div>
          <div>
            <div>優先度：{{ wordPriority }}</div>
            <BaseSlider
              v-model="wordPriority"
              :min="0"
              :max="10"
              :step="1"
              @valueCommit="saveWord"
            />
            <div class="slider-label">
              <span>最低</span>
              <span>標準</span>
              <span>最高</span>
            </div>
          </div>
        </div>
      </div>
    </BaseScrollArea>
    <footer v-if="!selectedId" class="footer">
      <BaseButton
        :disabled="uiLocked"
        label="キャンセル"
        @click="discardOrNotDialog(cancel)"
      />
      <BaseButton
        :disabled="uiLocked || !isWordChanged"
        variant="primary"
        label="追加"
        @click="addWord"
      />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { inject, ref } from "vue";
import { dictionaryManageDialogContextKey } from "./DictionaryManageDialog.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseSlider from "@/components/Base/BaseSlider.vue";
import BaseTextField from "@/components/Base/BaseTextField.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import AudioAccent from "@/components/Talk/AudioAccent.vue";
import { useStore } from "@/store";
import type { FetchAudioResult } from "@/store/type";
import { debounce } from "@/helpers/timer";

const store = useStore();

const context = inject(dictionaryManageDialogContextKey);
if (context == undefined)
  throw new Error(`dictionaryManageDialogContext == undefined`);
const {
  wordEditing,
  surfaceInput,
  selectedId,
  uiLocked,
  userDict,
  isOnlyHiraOrKana,
  accentPhrase,
  voiceComputed,
  surface,
  yomi,
  wordPriority,
  isWordChanged,
  setYomi,
  createUILockAction,
  loadingDictProcess,
  computeRegisteredAccent,
  discardOrNotDialog,
  toInitialState,
  cancel,
} = context;

// 音声再生機構
const nowGenerating = ref(false);
const nowPlaying = ref(false);

const play = async () => {
  if (!accentPhrase.value) return;

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

// メニュー系
const yomiInput = ref<typeof BaseTextField>();

const convertHankakuToZenkaku = (text: string) => {
  // " "などの目に見えない文字をまとめて全角スペース(0x3000)に置き換える
  text = text.replace(/\p{Z}/gu, () => String.fromCharCode(0x3000));

  // "!"から"~"までの範囲の文字(数字やアルファベット)を全角に置き換える
  return text.replace(/[\u0021-\u007e]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) + 0xfee0);
  });
};

const setSurface = (text: string) => {
  // surfaceを全角化する
  // 入力は半角でも問題ないが、登録時に全角に変換され、isWordChangedの判断がおかしくなることがあるので、
  // 入力後に自動で変換するようにする
  surface.value = convertHankakuToZenkaku(text);
};

const saveWord = debounce(async () => {
  if (!selectedId.value || !accentPhrase.value) return;
  const accent = computeRegisteredAccent();

  const word = {
    surface: surface.value,
    accentType: accent,
    priority: wordPriority.value,
  };

  try {
    await store.actions.REWRITE_WORD({
      ...word,
      wordUuid: selectedId.value,
      pronunciation: yomi.value,
    });
    userDict.value[selectedId.value] = {
      ...userDict.value[selectedId.value],
      ...word,
      yomi: yomi.value,
    };
  } catch (e) {
    void store.actions.SHOW_ALERT_DIALOG({
      title: "単語の更新に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    throw e;
  }
}, 300);

const addWord = async () => {
  if (!accentPhrase.value) throw new Error(`accentPhrase === undefined`);
  const accent = computeRegisteredAccent();

  try {
    await createUILockAction(
      store.actions.ADD_WORD({
        surface: surface.value,
        pronunciation: yomi.value,
        accentType: accent,
        priority: wordPriority.value,
      }),
    );
  } catch (e) {
    void store.actions.SHOW_ALERT_DIALOG({
      title: "単語の登録に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    throw e;
  }
  await loadingDictProcess();
  toInitialState();
};

const changeAccent = async (_: number, accent: number) => {
  const { engineId, styleId } = voiceComputed.value;

  if (accentPhrase.value) {
    accentPhrase.value.accent = accent;
    accentPhrase.value = (
      await createUILockAction(
        store.actions.FETCH_MORA_DATA({
          accentPhrases: [accentPhrase.value],
          engineId,
          styleId,
        }),
      )
    )[0];
  }
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
