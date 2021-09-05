<template>
  <div class="mora-text-editor">
    <div class="mora-text-description">
      カタカナで読みを入力。無声化したい場合は読みの手前に(_)を入れる。
      アクセント位置は(')、句切りは(/)、無音区間付きの句切りは(、)で記述。
    </div>
    <q-input
      class="mora-text-input"
      :model-value="moraText"
      :error="parseError !== null"
      @change="moraText = $event"
      :disable="uiLocked"
    >
      <template v-slot:error>
        {{ parseError }}
      </template>
    </q-input>
  </div>
</template>

<script lang="ts">
import { PropType, computed, defineComponent, ref, watch } from "vue";
import { Result, toOk, toErr, isOk } from "@/utils/result";
import { Mora, AccentPhrase } from "@/openapi/models";
import {
  text2mora,
  UNVOICE_SYMBOL,
  ACCENT_SYMBOL,
  PAUSE_DELIMITER,
  NOPAUSE_DELIMITER,
} from "@/utils/moraList";

/**
 * longest matchにより読み仮名からAccentPhraseを生成
 * 入力長Nに対し計算量O(N^2)
 */
const textToAccentPhrase = (phrase: string): Result<AccentPhrase, string> => {
  let accentIndex: number | null = null;
  let moras: Mora[] = [];

  let baseIdx = 0; // パース開始位置。ここから右の文字列をstackに詰めていく。
  let stack = ""; // 保留中の文字列
  let matchedStackTop = 0; // 保留中の文字列内で最後にマッチした位置の一つ右(0は未マッチ)
  let matchedMora: Mora | null = null; // 保留中の文字列内で最後にマッチしたモーラ

  const pushMora = (): Result<boolean, string> => {
    if (matchedMora === null) {
      return toErr("判別できない読みがながあります: " + stack);
    } else {
      moras.push(matchedMora);
      baseIdx += matchedStackTop;
      stack = "";
      matchedStackTop = 0;
      matchedMora = null;
      return toOk(true);
    }
  };

  let outerLoop = 0;
  while (baseIdx < phrase.length) {
    outerLoop++;
    if (phrase[baseIdx] === ACCENT_SYMBOL) {
      if (moras.length === 0) {
        return toErr("アクセントを句頭に置くことは出来ません: " + phrase);
      }
      if (accentIndex !== null) {
        return toErr(
          "一つのアクセント句に二つ以上のアクセントは置けません: " + phrase
        );
      }
      accentIndex = moras.length;
      baseIdx++;
      continue;
    }
    for (let watchIdx = baseIdx; watchIdx < phrase.length; watchIdx++) {
      if (phrase[watchIdx] === ACCENT_SYMBOL) {
        break;
      }
      // 普通の文字の場合
      stack += phrase[watchIdx];
      const mora = text2mora.get(stack);
      if (mora) {
        matchedStackTop = stack.length;
        matchedMora = mora;
      }
    }
    const pushResult = pushMora();
    if (!isOk(pushResult)) return pushResult;
    if (outerLoop > 300) {
      return toErr(
        "処理時に無限ループになってしまいました...バグ報告をお願いします。"
      );
    }
  }

  if (accentIndex === null) {
    return toErr("アクセントを指定していないアクセント句があります: " + phrase);
  } else {
    return toOk({ moras, accent: accentIndex });
  }
};

const parse = (text: string): Result<AccentPhrase[], string> => {
  const parsedResults: AccentPhrase[] = [];
  let phraseBase = 0;
  for (let i = 0; i <= text.length; i++) {
    if (
      i === text.length ||
      text[i] === PAUSE_DELIMITER ||
      text[i] === NOPAUSE_DELIMITER
    ) {
      const phrase = text.slice(phraseBase, Math.max(0, i));
      if (phrase.length === 0) {
        return toErr(
          `${parsedResults.length + 1}番目のアクセント句が空白です。`
        );
      }
      phraseBase = i + 1;
      const result = textToAccentPhrase(phrase);
      if (isOk(result)) {
        const accentPhrase = result.value;
        if (i < text.length && text[i] === PAUSE_DELIMITER) {
          accentPhrase.pauseMora = {
            text: "、",
            vowel: "pau",
            pitch: 0,
          };
        }
        parsedResults.push(accentPhrase);
        continue;
      } else {
        // Errを伝播する
        return result;
      }
    }
  }
  return toOk(parsedResults);
};

export default defineComponent({
  name: "AudioMora",

  props: {
    accentPhrases: { type: Array as PropType<AccentPhrase[]>, required: true },
    uiLocked: { type: Boolean, required: true },
  },

  emits: ["changeAccentPhrases"],

  setup(props, { emit }) {
    const accentPhrases = computed(() => props.accentPhrases);
    const parseError = ref<string | null>(null);
    const moraTextPending = ref("");
    const moraText = computed({
      get: () => {
        if (parseError.value) {
          // ユーザーが入力した間違った文字列をそのまま出力
          return moraTextPending.value;
        } else {
          // accentPhrasesからテキストを生成
          let text = "";
          props.accentPhrases.forEach((accentPhrase, pIndex) => {
            accentPhrase.moras.forEach((mora, index) => {
              if (["A", "I", "U", "E", "O"].includes(mora.vowel)) {
                text += UNVOICE_SYMBOL;
              }
              text += mora.text;
              if (index + 1 === accentPhrase.accent) {
                text += ACCENT_SYMBOL;
              }
            });
            if (pIndex !== props.accentPhrases.length - 1) {
              if (accentPhrase.pauseMora) {
                text += PAUSE_DELIMITER;
              } else {
                text += NOPAUSE_DELIMITER;
              }
            }
          });
          return text;
        }
      },
      set: (text: string) => {
        moraTextPending.value = text;
        const result = parse(text);
        if (isOk(result)) {
          emit("changeAccentPhrases", result.value);
        } else {
          parseError.value = result.value;
        }
      },
    });

    watch(accentPhrases, () => {
      parseError.value = null;
    });

    return {
      moraText,
      moraTextPending,
      parseError,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

.mora-text-editor {
  display: block;

  .mora-text-description {
    color: global.$primary;
  }
  .mora-text-input {
    width: 100%;
  }
}
</style>
