<template>
  <!-- スライダーここから -->
  <!-- ｱｸｾﾝﾄ項目のスライダー -->
  <template v-if="selectedDetail === 'accent'">
    <audio-accent
      :accent-phrase-index="index"
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
        'text-cell-hovered': isHovered(mora.vowel, moraIndex),
      }"
      :style="{
        'grid-column': `${moraIndex * 2 + 1} / span 1`,
      }"
      @mouseover="handleHoverText(true, moraIndex)"
      @mouseleave="handleHoverText(false, moraIndex)"
      @click.stop="uiLocked || handleChangeVoicing(mora, moraIndex)"
    >
      <span class="text-cell-inner">
        {{ getHoveredText(mora, moraIndex) }}
      </span>
      <q-popup-edit
        v-if="selectedDetail == 'accent' && !uiLocked"
        v-slot="scope"
        :model-value="pronunciation"
        auto-save
        transition-show="none"
        transition-hide="none"
        @save="handleChangePronounce($event)"
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
      v-if="!isLast || moraIndex < accentPhrase.moras.length - 1"
      :class="[
        'splitter-cell',
        {
          'splitter-cell-accent': selectedDetail == 'accent',
          'splitter-cell-be-split': moraIndex == accentPhrase.moras.length - 1,
          'splitter-cell-be-split-pause': accentPhrase.pauseMora,
        },
      ]"
      :style="{ 'grid-column': `${moraIndex * 2 + 2} / span 1` }"
      @click.stop="uiLocked || toggleAccentPhraseSplit(false, moraIndex)"
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
      @click.stop="uiLocked || toggleAccentPhraseSplit(true)"
    />
  </template>
  <!-- 読みテキスト・アクセント句の分割と結合ここまで -->
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import AudioAccent from "./AudioAccent.vue";
import AudioParameter from "./AudioParameter.vue";
import { useStore } from "@/store";
import { AudioKey, MoraDataType } from "@/type/preload";
import { Mora } from "@/openapi/models/Mora";
import { AccentPhrase } from "@/openapi";

const props =
  defineProps<{
    audioKey: AudioKey;
    accentPhrase: AccentPhrase;
    index: number;
    isLast: boolean;
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

const handleChangePronounce = (newPronunciation: string) => {
  let popUntilPause = false;
  const lastMora = newPronunciation.at(-1);
  if (lastMora == "、" || lastMora == ",") {
    if (props.isLast) {
      // 末尾の句点を削除
      const pronunciation = newPronunciation.match(/(.*?)(?:、|,)+$/)?.[1];
      if (pronunciation == null) throw new Error("pronunciation == null");
      newPronunciation = pronunciation;
    } else {
      // 生成エラー回避
      newPronunciation += "ア";
      popUntilPause = true;
    }
  }
  store.dispatch("COMMAND_CHANGE_SINGLE_ACCENT_PHRASE", {
    audioKey: props.audioKey,
    newPronunciation,
    accentPhraseIndex: props.index,
    popUntilPause,
  });
};

type hoveredType = "vowel" | "consonant";

const isAccentHovered = ref(false);

const hoveredPitchMoraIndex = ref<number | undefined>(undefined);

const lengthHoveredInfo = reactive<{
  moraIndex: number | undefined;
  type: hoveredType;
}>({
  moraIndex: undefined,
  type: "vowel",
});

const handleHoverText = (isOver: boolean, moraIndex: number) => {
  if (props.selectedDetail == "accent") {
    isAccentHovered.value = isOver;
  } else if (props.selectedDetail == "pitch") {
    hoveredPitchMoraIndex.value = isOver ? moraIndex : undefined;
  }
};

const handleLengthHoverText = (
  isOver: boolean,
  phoneme: MoraDataType,
  moraIndex?: number
) => {
  if (phoneme !== "vowel" && phoneme !== "consonant")
    throw new Error("phoneme != hoveredType");
  lengthHoveredInfo.type = phoneme;
  // the pause and pitch templates don't emit a mouseOver event
  lengthHoveredInfo.moraIndex = isOver ? moraIndex : undefined;
};

const unvoicableVowels = ["U", "I", "i", "u"];

const isHovered = (vowel: string, moraIndex: number) => {
  let isHover = false;
  if (!uiLocked.value) {
    if (props.selectedDetail == "accent") {
      if (isAccentHovered.value) {
        isHover = true;
      }
    } else if (props.selectedDetail == "pitch") {
      if (
        moraIndex === hoveredPitchMoraIndex.value &&
        unvoicableVowels.includes(vowel)
      ) {
        isHover = true;
      }
    }
  }
  return isHover;
};

const getHoveredText = (mora: Mora, moraIndex: number) => {
  if (props.selectedDetail != "length") return mora.text;
  if (moraIndex === lengthHoveredInfo.moraIndex) {
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
    audioKey: props.audioKey,
    accentPhraseIndex,
    accent,
  });
const toggleAccentPhraseSplit = (isPause: boolean, moraIndex?: number) => {
  store.dispatch("COMMAND_CHANGE_ACCENT_PHRASE_SPLIT", {
    audioKey: props.audioKey,
    accentPhraseIndex: props.index,
    ...(!isPause ? { isPause, moraIndex: moraIndex as number } : { isPause }),
  });
};

const lastPitches = computed(() =>
  props.accentPhrase.moras.map((mora) => mora.pitch)
);

const maxPitch = 6.5;
const minPitch = 3;
const maxMoraLength = 0.3;
const minMoraLength = 0;
const changeMoraData = (
  moraIndex: number,
  data: number,
  type: MoraDataType
) => {
  const accentPhraseIndex = props.index;
  if (!props.altKeyFlag) {
    if (type == "pitch") {
      lastPitches.value[moraIndex] = data;
    }
    return store.dispatch("COMMAND_SET_AUDIO_MORA_DATA", {
      audioKey: props.audioKey,
      accentPhraseIndex,
      moraIndex,
      data,
      type,
    });
  } else {
    return store.dispatch("COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE", {
      audioKey: props.audioKey,
      accentPhraseIndex,
      moraIndex,
      data,
      type,
    });
  }
};

const handleChangeVoicing = (mora: Mora, moraIndex: number) => {
  if (
    props.selectedDetail == "pitch" &&
    unvoicableVowels.includes(mora.vowel)
  ) {
    let data = 0;
    if (mora.pitch == 0) {
      if (lastPitches.value[moraIndex] == 0) {
        // 元々無声だった場合、適当な値を代入
        data = 5.5;
      } else {
        data = lastPitches.value[moraIndex];
      }
    }
    changeMoraData(moraIndex, data, "voicing");
  }
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

$pitch-label-height: 24px;

.text-cell {
  min-width: 20px;
  max-width: 20px;
  grid-row-start: 3;
  text-align: center;
  white-space: nowrap;
  color: colors.$display;
  position: relative;
}
.text-cell-inner {
  position: absolute;
  transform: translateX(-50%);
  z-index: 10;
}
.text-cell-hovered {
  font-weight: bold;
  cursor: pointer;
}
.splitter-cell {
  min-width: 20px;
  max-width: 20px;
  grid-row: 3 / span 1;
  z-index: vars.$detail-view-splitter-cell-z-index;
}
.splitter-cell-accent {
  @extend.splitter-cell;
  grid-row: 2 / 4;
}
.splitter-cell:hover {
  background-color: colors.$text-splitter-hover;
  cursor: pointer;
}
.splitter-cell-be-split {
  min-width: 40px;
  max-width: 40px;
  grid-row: 1 / span 3;
}
.splitter-cell-be-split-pause {
  min-width: 20px;
  max-width: 20px;
}
.pitch-cell {
  grid-row: 1 / span 2;
  min-width: 20px;
  max-width: 20px;
  display: inline-block;
  position: relative;
}
</style>
