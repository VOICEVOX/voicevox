<template>
  <!-- スライダーここから -->
  <!-- ｱｸｾﾝﾄ項目のスライダー -->
  <template v-if="selectedDetail === 'accent'">
    <audio-accent
      :accent-phrase-index="accentPhraseIndex"
      :accent-phrase="accentPhrase"
      :ui-locked="uiLocked"
      :shift-key-flag="shiftKeyFlag"
      :on-change-accent="changeAccent"
    />
  </template>
  <!-- ｲﾝﾄﾈｰｼｮﾝ項目のスライダー -->
  <template v-if="selectedDetail === 'pitch'">
    <div
      v-for="(mora, moraIndex) in accentPhrase.moras"
      :key="moraIndex"
      class="q-mb-sm pitch-cell"
      :style="{ 'grid-column': `${moraIndex * 2 + 1} / span 1` }"
    >
      <audio-parameter
        :mora-index="moraIndex"
        :accent-phrase-index="accentPhraseIndex"
        :value="mora.pitch"
        :ui-locked="uiLocked"
        :min="minPitch"
        :max="maxPitch"
        :disable="mora.pitch == 0.0"
        :type="'pitch'"
        :clip="false"
        :shift-key-flag="shiftKeyFlag"
        @change-value="changeMoraData"
      />
    </div>
    <div v-if="accentPhrase.pauseMora" />
  </template>
  <!-- 長さ項目のスライダー -->
  <template v-if="selectedDetail === 'length'">
    <div
      v-for="(mora, moraIndex) in accentPhrase.moras"
      :key="moraIndex"
      class="q-mb-sm pitch-cell"
      :style="{ 'grid-column': `${moraIndex * 2 + 1} / span 1` }"
    >
      <!-- consonant length -->
      <audio-parameter
        v-if="mora.consonant && mora.consonantLength != undefined"
        :mora-index="moraIndex"
        :accent-phrase-index="accentPhraseIndex"
        :value="mora.consonantLength"
        :ui-locked="uiLocked"
        :min="minMoraLength"
        :max="maxMoraLength"
        :step="0.001"
        :type="'consonant'"
        :clip="true"
        :shift-key-flag="shiftKeyFlag"
        @change-value="changeMoraData"
        @mouse-over="handleLengthHoverText"
      />
      <!-- vowel length -->
      <audio-parameter
        :mora-index="moraIndex"
        :accent-phrase-index="accentPhraseIndex"
        :value="mora.vowelLength"
        :ui-locked="uiLocked"
        :min="minMoraLength"
        :max="maxMoraLength"
        :step="0.001"
        :type="'vowel'"
        :clip="mora.consonant ? true : false"
        :shift-key-flag="shiftKeyFlag"
        @change-value="changeMoraData"
        @mouse-over="handleLengthHoverText"
      />
    </div>
    <div
      v-if="accentPhrase.pauseMora"
      class="q-mb-sm pitch-cell"
      :style="{
        'grid-column': `${accentPhrase.moras.length * 2 + 1} / span 1`,
      }"
    >
      <!-- pause length -->
      <audio-parameter
        :mora-index="accentPhrase.moras.length"
        :accent-phrase-index="accentPhraseIndex"
        :value="accentPhrase.pauseMora.vowelLength"
        :ui-locked="uiLocked"
        :min="0"
        :max="1.0"
        :step="0.01"
        :type="'pause'"
        :shift-key-flag="shiftKeyFlag"
        @change-value="changeMoraData"
      />
    </div>
  </template>
  <!-- スライダーここまで -->
  <!-- 読みテキスト・アクセント句の分割と結合ここから -->
  <template v-for="(mora, moraIndex) in accentPhrase.moras" :key="moraIndex">
    <div
      class="text-cell"
      :class="{
        'text-cell-hovered': isHovered(
          mora.vowel,
          accentPhraseIndex,
          moraIndex
        ),
      }"
      :style="{
        'grid-column': `${moraIndex * 2 + 1} / span 1`,
      }"
      @mouseover="handleHoverText(true, accentPhraseIndex, moraIndex)"
      @mouseleave="handleHoverText(false, accentPhraseIndex, moraIndex)"
      @click.stop="
        uiLocked || handleChangeVoicing(mora, accentPhraseIndex, moraIndex)
      "
    >
      <span class="text-cell-inner">
        {{ getHoveredText(mora, accentPhraseIndex, moraIndex) }}
      </span>
      <q-popup-edit
        v-if="selectedDetail == 'accent' && !uiLocked"
        v-slot="scope"
        :model-value="pronunciation"
        auto-save
        transition-show="none"
        transition-hide="none"
        @save="handleChangePronounce($event, accentPhraseIndex)"
      >
        <q-input
          v-model="scope.value"
          dense
          :input-style="{
            width: `${scope.value.length + 1}em`,
            minWidth: '50px',
          }"
          autofocus
          outlined
          @keyup.enter="scope.set"
        />
      </q-popup-edit>
    </div>
    <div
      v-if="
        accentPhrases != undefined &&
        (accentPhraseIndex < accentPhrases.length - 1 ||
          moraIndex < accentPhrase.moras.length - 1)
      "
      :class="[
        'splitter-cell',
        {
          'splitter-cell-accent': selectedDetail == 'accent',
          'splitter-cell-be-split': moraIndex == accentPhrase.moras.length - 1,
          'splitter-cell-be-split-pause': accentPhrase.pauseMora,
        },
      ]"
      :style="{ 'grid-column': `${moraIndex * 2 + 2} / span 1` }"
      @click.stop="
        uiLocked || toggleAccentPhraseSplit(accentPhraseIndex, false, moraIndex)
      "
    />
  </template>
  <template v-if="accentPhrase.pauseMora">
    <div class="text-cell">
      <span class="text-cell-inner">
        {{ accentPhrase.pauseMora.text }}
      </span>
    </div>
    <div
      class="splitter-cell splitter-cell-be-split splitter-cell-be-split-pause"
      @click.stop="uiLocked || toggleAccentPhraseSplit(accentPhraseIndex, true)"
    />
  </template>
  <!-- 読みテキスト・アクセント句の分割と結合ここまで -->
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { useStore } from "@/store";
import { MoraDataType } from "@/type/preload";
import { Mora } from "@/openapi/models/Mora";
import { AccentPhrase } from "@/openapi";

const props =
  defineProps<{
    selectedDetail: DetailTypes;
    shiftKeyFlag: boolean;
    altKeyFlag: boolean;
  }>();

type DetailTypes = "accent" | "pitch" | "length" | "play" | "stop" | "save";

const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);

const pronunciation = computed(() => {
  let textString = props.accentPhrase.moras.map((mora) => mora.text).join("");
  if (props.accentPhrase.pauseMora) {
    textString += "、";
  }
  return textString;
});

const handleChangePronounce = (
  newPronunciation: string,
  phraseIndex: number
) => {
  let popUntilPause = false;
  newPronunciation = newPronunciation.replace(",", "、");
  if (accentPhrases.value == undefined)
    throw new Error("accentPhrases.value == undefined");
  if (
    newPronunciation.slice(-1) == "、" &&
    accentPhrases.value.length - 1 != phraseIndex
  ) {
    newPronunciation += pronunciationByPhrase.value[phraseIndex + 1];
    popUntilPause = true;
  }
  store.dispatch("COMMAND_CHANGE_SINGLE_ACCENT_PHRASE", {
    audioKey: props.activeAudioKey,
    newPronunciation,
    accentPhraseIndex: phraseIndex,
    popUntilPause,
  });
};

type hoveredType = "vowel" | "consonant";

type hoveredInfoType = {
  accentPhraseIndex: number | undefined;
  moraIndex?: number | undefined;
  type?: hoveredType;
};

const accentHoveredInfo = reactive<hoveredInfoType>({
  accentPhraseIndex: undefined,
});

const pitchHoveredInfo = reactive<hoveredInfoType>({
  accentPhraseIndex: undefined,
  moraIndex: undefined,
});

const lengthHoveredInfo = reactive<hoveredInfoType>({
  accentPhraseIndex: undefined,
  moraIndex: undefined,
  type: "vowel",
});

const handleHoverText = (
  isOver: boolean,
  phraseIndex: number,
  moraIndex: number
) => {
  if (props.selectedDetail == "accent") {
    if (isOver) {
      accentHoveredInfo.accentPhraseIndex = phraseIndex;
    } else {
      accentHoveredInfo.accentPhraseIndex = undefined;
    }
  } else if (props.selectedDetail == "pitch") {
    if (isOver) {
      pitchHoveredInfo.accentPhraseIndex = phraseIndex;
      pitchHoveredInfo.moraIndex = moraIndex;
    } else {
      pitchHoveredInfo.accentPhraseIndex = undefined;
      pitchHoveredInfo.moraIndex = undefined;
    }
  }
};

const handleLengthHoverText = (
  isOver: boolean,
  phoneme: MoraDataType,
  phraseIndex: number,
  moraIndex?: number
) => {
  if (phoneme !== "vowel" && phoneme !== "consonant")
    throw new Error("phoneme != hoveredType");
  lengthHoveredInfo.type = phoneme;
  // the pause and pitch templates don't emit a mouseOver event
  if (isOver) {
    lengthHoveredInfo.accentPhraseIndex = phraseIndex;
    lengthHoveredInfo.moraIndex = moraIndex;
  } else {
    lengthHoveredInfo.accentPhraseIndex = undefined;
    lengthHoveredInfo.moraIndex = undefined;
  }
};

const unvoicableVowels = ["U", "I", "i", "u"];

const isHovered = (
  vowel: string,
  accentPhraseIndex: number,
  moraIndex: number
) => {
  let isHover = false;
  if (!uiLocked.value) {
    if (props.selectedDetail == "accent") {
      if (accentPhraseIndex === accentHoveredInfo.accentPhraseIndex) {
        isHover = true;
      }
    } else if (props.selectedDetail == "pitch") {
      if (
        accentPhraseIndex === pitchHoveredInfo.accentPhraseIndex &&
        moraIndex === pitchHoveredInfo.moraIndex &&
        unvoicableVowels.includes(vowel)
      ) {
        isHover = true;
      }
    }
  }
  return isHover;
};

const getHoveredText = (
  mora: Mora,
  accentPhraseIndex: number,
  moraIndex: number
) => {
  if (props.selectedDetail != "length") return mora.text;
  if (
    accentPhraseIndex === lengthHoveredInfo.accentPhraseIndex &&
    moraIndex === lengthHoveredInfo.moraIndex
  ) {
    if (lengthHoveredInfo.type == "vowel") {
      return mora.vowel.toUpperCase();
    } else {
      return mora.consonant?.toUpperCase();
    }
  } else {
    return mora.text;
  }
};

const changeAccent = (accentPhraseIndex: number, accent: number) =>
  store.dispatch("COMMAND_CHANGE_ACCENT", {
    audioKey: props.activeAudioKey,
    accentPhraseIndex,
    accent,
  });
const toggleAccentPhraseSplit = (
  accentPhraseIndex: number,
  isPause: boolean,
  moraIndex?: number
) => {
  store.dispatch("COMMAND_CHANGE_ACCENT_PHRASE_SPLIT", {
    audioKey: props.activeAudioKey,
    accentPhraseIndex,
    ...(!isPause ? { isPause, moraIndex: moraIndex as number } : { isPause }),
  });
};

const maxPitch = 6.5;
const minPitch = 3;
const maxMoraLength = 0.3;
const minMoraLength = 0;
const changeMoraData = (
  accentPhraseIndex: number,
  moraIndex: number,
  data: number,
  type: MoraDataType
) => {
  if (!props.altKeyFlag) {
    if (type == "pitch") {
      lastPitches.value[accentPhraseIndex][moraIndex] = data;
    }
    return store.dispatch("COMMAND_SET_AUDIO_MORA_DATA", {
      audioKey: props.activeAudioKey,
      accentPhraseIndex,
      moraIndex,
      data,
      type,
    });
  } else {
    return store.dispatch("COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE", {
      audioKey: props.activeAudioKey,
      accentPhraseIndex,
      moraIndex,
      data,
      type,
    });
  }
};

const handleChangeVoicing = (
  mora: Mora,
  accentPhraseIndex: number,
  moraIndex: number
) => {
  if (
    props.selectedDetail == "pitch" &&
    unvoicableVowels.includes(mora.vowel)
  ) {
    let data = 0;
    if (mora.pitch == 0) {
      if (lastPitches.value[accentPhraseIndex][moraIndex] == 0) {
        // 元々無声だった場合、適当な値を代入
        data = 5.5;
      } else {
        data = lastPitches.value[accentPhraseIndex][moraIndex];
      }
    }
    changeMoraData(accentPhraseIndex, moraIndex, data, "voicing");
  }
};
</script>

<style scoped lang="scss">
</style>
