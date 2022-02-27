<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog"
    v-model="dictionaryManageDialogOpenedComputed"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-background">
      <q-page-container>
        <q-header class="q-pa-sm">
          <q-toolbar>
            <q-toolbar-title class="text-display">辞書管理</q-toolbar-title>
            <q-space />
            <!-- close button -->
            <q-btn
              round
              flat
              icon="close"
              color="display"
              @click="discardOrNotDialog(closeDialogProcess)"
            />
          </q-toolbar>
        </q-header>
        <q-page class="row">
          <div v-if="loadingDict" class="loading-dict">
            <div>
              <q-spinner color="primary" size="2.5rem" />
              <div class="q-mt-xs">読み込み中・・・</div>
            </div>
          </div>
          <div class="col-4 word-list-col">
            <div class="text-h5 q-pa-sm">単語一覧</div>
            <q-list class="word-list">
              <q-item
                v-for="(value, key) in userDict"
                :key="key"
                tag="label"
                v-ripple
                clickable
                @click="discardOrNotDialog(() => selectWord(key))"
                :active="selectedId === key"
                active-class="active-word"
              >
                <q-item-section>
                  <q-item-label class="text-display">{{
                    value.surface
                  }}</q-item-label>
                  <q-item-label caption>{{ value.yomi }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <div class="col-8 no-wrap text-no-wrap">
            <div class="row q-pl-md q-mt-md">
              <div class="text-h6">単語</div>
              <form @submit.stop="yomiInput.focus()">
                <q-input
                  ref="surfaceInput"
                  class="word-input"
                  v-model="surface"
                  dense
                  :disable="uiLocked"
                />
              </form>
            </div>
            <div class="row q-pl-md q-pt-sm">
              <div class="text-h6">読み</div>
              <form @submit.stop="yomiInput.blur()">
                <q-input
                  ref="yomiInput"
                  class="word-input"
                  v-model="yomi"
                  @blur="setYomi(yomi)"
                  dense
                  :error="!isOnlyHiraOrKana"
                  :disable="uiLocked"
                >
                  <template v-slot:error>
                    読みに使える文字はひらがなとカタカナのみです。
                  </template>
                </q-input>
              </form>
            </div>
            <div class="row q-pl-md q-pt-sm text-h6">アクセント調整</div>
            <div class="row q-pl-md accent-desc">
              語尾のアクセントを考慮するため、「は(ワ)」が自動で挿入されます。
            </div>
            <div class="row q-px-md" style="height: 130px">
              <div class="play-button">
                <q-btn
                  v-if="!nowPlaying && !nowGenerating"
                  fab
                  color="primary-light"
                  text-color="display-dark"
                  icon="play_arrow"
                  @click="play"
                />
                <q-btn
                  v-else
                  fab
                  color="primary-light"
                  text-color="display-dark"
                  icon="stop"
                  @click="stop"
                  :disable="nowGenerating"
                />
              </div>
              <div
                ref="accentPhraseTable"
                class="accent-phrase-table overflow-hidden-y"
                :style="[centeringAccentPhrase && 'justify-content: center']"
              >
                <div v-if="accentPhrase" class="mora-table">
                  <audio-accent
                    :accent-phrase="accentPhrase"
                    :accent-phrase-index="0"
                    :ui-locked="uiLocked"
                    @changeAccent="changeAccent"
                  />
                  <template
                    v-for="(mora, moraIndex) in accentPhrase.moras"
                    :key="moraIndex"
                  >
                    <div
                      class="text-cell"
                      :style="{
                        'grid-column': `${moraIndex * 2 + 1} / span 1`,
                      }"
                    >
                      {{ mora.text }}
                    </div>
                    <div
                      v-if="moraIndex < accentPhrase.moras.length - 1"
                      class="splitter-cell"
                      :style="{
                        'grid-column': `${moraIndex * 2 + 2} / span 1`,
                      }"
                    />
                  </template>
                </div>
              </div>
            </div>
            <div class="row q-px-md save-and-delete-buttons">
              <q-btn
                outline
                text-color="display"
                class="text-no-wrap text-bold q-mr-sm"
                @click="saveWord"
                :disable="uiLocked || !isWordChanged"
                >保存</q-btn
              >
            </div>
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, ref, watch } from "vue";
import { useStore } from "@/store";
import { toDispatchResponse } from "@/store/audio";
import { AccentPhrase, AudioQuery, UserDictWord } from "@/openapi";
import {
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
} from "@/store/utility";
import AudioAccent from "@/components/AudioAccent.vue";
import { EngineInfo } from "@/type/preload";
import { QInput, useQuasar } from "quasar";
import { AudioItem } from "@/store/type";

export default defineComponent({
  name: "DictionaryManageDialog",
  components: { AudioAccent },
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();
    const $q = useQuasar();

    let engineInfo: EngineInfo | undefined;
    const dictionaryManageDialogOpenedComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });
    const uiLocked = computed(() => store.getters.UI_LOCKED);
    const nowGenerating = ref(false);
    const nowPlaying = ref(false);

    const loadingDict = ref(false);
    const userDict = ref<{ [key: string]: UserDictWord }>({});

    watch(dictionaryManageDialogOpenedComputed, async (newValue) => {
      if (newValue) {
        engineInfo = store.state.engineInfos[0]; // TODO: 複数エンジン対応
        if (!engineInfo)
          throw new Error(`No such engineInfo registered: index == 0`);
        loadingDict.value = true;
        userDict.value = await store
          .dispatch("INVOKE_ENGINE_CONNECTOR", {
            engineKey: engineInfo.key,
            action: "getUserDictWordsUserDictGet",
            payload: [],
          })
          .then(toDispatchResponse("getUserDictWordsUserDictGet"));
        loadingDict.value = false;
      }
    });
    const closeDialogProcess = () => {
      dictionaryManageDialogOpenedComputed.value = false;
      selectedId.value = "";
      surface.value = "";
      setYomi("");
    };

    const surfaceInput = ref<QInput>();
    const yomiInput = ref<QInput>();

    const selectedId = ref("");
    const surface = ref("");
    const yomi = ref("");
    const selectWord = (id: string) => {
      selectedId.value = id;
      surface.value = userDict.value[id].surface;
      setYomi(userDict.value[id].yomi, userDict.value[id].accentType);
    };

    const kanaRegex = createKanaRegex();
    const isOnlyHiraOrKana = ref(true);
    const accentPhrase = ref<AccentPhrase | undefined>();
    const accentPhraseTable = ref<HTMLElement>();
    // スクロールしなければならないほど長いアクセント句はセンタリングしないようにする
    // computedにすると、ダイアログを表示した際にしか動作しないので、refにして変更時に代入する
    const centeringAccentPhrase = ref(true);
    const computeCenteringAccentPhrase = () => {
      centeringAccentPhrase.value =
        !!accentPhraseTable.value &&
        accentPhraseTable.value.scrollWidth ==
          accentPhraseTable.value.offsetWidth;
    };
    const setYomi = async (text: string, accent?: number) => {
      // テキスト長が0の時にエラー表示にならないように、テキスト長を考慮する
      isOnlyHiraOrKana.value = !text.length || kanaRegex.test(text);
      // 文字列が変更されていない場合は、アクセントフレーズに変更を加えない
      // 「ワ」が自動挿入されるので、それを考慮してsliceしている
      if (
        text ==
        accentPhrase.value?.moras
          .map((v) => v.text)
          .join("")
          .slice(0, -1)
      )
        return;
      if (isOnlyHiraOrKana.value && text.length) {
        text = convertHiraToKana(text);
        text = convertLongVowel(text);
        accentPhrase.value = (
          await store.dispatch("FETCH_ACCENT_PHRASES", {
            text: text + "ワ'",
            styleId: 0,
            isKana: true,
          })
        ).map((v) => {
          if (accent !== undefined) v.accent = accent;
          return v;
        })[0];
      } else {
        accentPhrase.value = undefined;
      }
      yomi.value = text;
      await nextTick();
      computeCenteringAccentPhrase();
    };
    window.onresize = computeCenteringAccentPhrase;

    const changeAccent = async (_: number, accent: number) => {
      if (accentPhrase.value) {
        accentPhrase.value.accent = accent;
        accentPhrase.value = (
          await store.dispatch("FETCH_MORA_DATA", {
            accentPhrases: [accentPhrase.value],
            styleId: 0,
          })
        )[0];
      }
    };

    const audioElem = new Audio();
    audioElem.pause();

    const play = async () => {
      if (!accentPhrase.value) return;
      nowGenerating.value = true;
      const query: AudioQuery = {
        accentPhrases: [accentPhrase.value],
        speedScale: 1.0,
        pitchScale: 0,
        intonationScale: 1.0,
        volumeScale: 1.0,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: store.state.savingSetting.outputSamplingRate,
        outputStereo: store.state.savingSetting.outputStereo,
      };

      const audioItem: AudioItem = {
        text: yomi.value,
        styleId: 0,
        query,
      };

      let blob = await store.dispatch("GET_AUDIO_CACHE_FROM_AUDIO_ITEM", {
        audioItem,
      });
      if (!blob) {
        blob = await store.dispatch("GENERATE_AUDIO_FROM_AUDIO_ITEM", {
          audioItem,
        });
        if (!blob) {
          nowGenerating.value = false;
          $q.dialog({
            title: "生成に失敗しました",
            message: "エンジンの再起動をお試しください。",
            ok: {
              label: "閉じる",
              flat: true,
              textColor: "display",
            },
          });
          return;
        }
      }
      nowGenerating.value = false;
      nowPlaying.value = true;
      await store.dispatch("PLAY_AUDIO_BLOB", { audioElem, audioBlob: blob });
      nowPlaying.value = false;
    };
    const stop = () => {
      audioElem.pause();
    };

    const isWordChanged = computed(() => {
      if (selectedId.value === "") {
        return surface.value && yomi.value && accentPhrase.value;
      }
      const dictData = userDict.value[selectedId.value];
      return (
        dictData.surface !== surface.value ||
        dictData.yomi !== yomi.value ||
        dictData.accentType !== accentPhrase.value?.accent
      );
    });
    const saveWord = async () => {
      if (!engineInfo)
        throw new Error(`No such engineInfo registered: index == 0`);
      if (!accentPhrase.value) throw new Error(`accentPhrase === undefined`);
      await store
        .dispatch("INVOKE_ENGINE_CONNECTOR", {
          engineKey: engineInfo.key,
          action: "addUserDictWordUserDictWordPost",
          payload: [
            {
              surface: surface.value,
              pronunciation: yomi.value,
              accentType: accentPhrase.value.accent,
            },
          ],
        })
        .then(toDispatchResponse("getUserDictWordsUserDictGet"));
    };
    const discardOrNotDialog = (okCallback: () => void) => {
      if (isWordChanged.value) {
        $q.dialog({
          title: "単語の追加・変更を破棄しますか？",
          message:
            "このまま続行すると、単語の追加・変更は破棄されてリセットされます。",
          persistent: true,
          focus: "cancel",
          ok: {
            label: "続行",
            flat: true,
            textColor: "display",
          },
          cancel: {
            label: "キャンセル",
            flat: true,
            textColor: "display",
          },
        }).onOk(okCallback);
      } else {
        okCallback();
      }
    };

    return {
      dictionaryManageDialogOpenedComputed,
      uiLocked,
      nowGenerating,
      nowPlaying,
      userDict,
      closeDialogProcess,
      loadingDict,
      surfaceInput,
      yomiInput,
      selectedId,
      surface,
      yomi,
      selectWord,
      isOnlyHiraOrKana,
      setYomi,
      accentPhrase,
      accentPhraseTable,
      centeringAccentPhrase,
      changeAccent,
      play,
      stop,
      isWordChanged,
      saveWord,
      discardOrNotDialog,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles/colors' as colors;
@use '@/styles/variables' as vars;

.word-list-col {
  border-right: solid 1px colors.$setting-item;
}

.word-list {
  // menubar-height + header-height + window-border-width
  // 46(title)
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width + 46px}
  );
  width: 100%;
  overflow-y: scroll;
}

.active-word {
  background: rgba(colors.$primary-rgb, 0.4);
}

.loading-dict {
  background-color: rgba(colors.$display-dark-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display-dark;
    background: colors.$background-light;
    border-radius: 6px;
    padding: 14px;
  }
}

.word-input {
  padding-left: 10px;
  width: calc(66vw - 80px);

  :deep(.q-field__control) {
    height: 2rem;
  }

  :deep(.q-placeholder) {
    padding: 0;
    font-size: 20px;
  }

  :deep(.q-field__after) {
    height: 2rem;
  }
}

.accent-desc {
  color: rgba(colors.$display-rgb, 0.5);
  font-size: 12px;
}

.play-button {
  margin: auto 0;
  padding-right: 16px;
}

.accent-phrase-table {
  flex-grow: 1;
  align-self: stretch;

  display: flex;
  overflow-x: scroll;
  width: calc(66vw - 140px);

  .mora-table {
    display: inline-grid;
    align-self: stretch;
    grid-template-rows: 1fr 60px 30px;

    .text-cell {
      padding: 0;
      min-width: 30px;
      max-width: 30px;
      grid-row-start: 3;
      text-align: center;
      color: colors.$display;
    }

    .splitter-cell {
      min-width: 10px;
      max-width: 10px;
      grid-row: 3 / span 1;
      z-index: vars.$detail-view-splitter-cell-z-index;
    }
  }
}

.save-and-delete-buttons {
  // menubar-height + header-height + window-border-width
  // 46(surface input) + 58(yomi input) + 38(accent title) + 18(accent desc) + 130(accent)
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width + 46px + 58px + 38px + 18px + 130px}
  );
  padding: 20px;

  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
}
</style>
