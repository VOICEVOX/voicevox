<template>
  <div
    ref="container"
    class="accent-phrase"
    :class="[
      isActive && 'accent-phrase-focus',
      uiLocked || 'accent-phrase-hover',
    ]"
    @click="$emit('click', index)"
  >
    <ContextMenu :menudata="contextMenudata" />
    <!-- スライダーここから -->
    <!-- ｱｸｾﾝﾄ項目のスライダー -->
    <template v-if="selectedDetail === 'accent'">
      <AudioAccent
        :accentPhraseIndex="index"
        :accentPhrase
        :uiLocked
        :shiftKeyFlag
        :onChangeAccent="changeAccent"
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
        <AudioParameter
          :moraIndex
          :value="mora.pitch"
          :uiLocked
          :min="minPitch"
          :max="maxPitch"
          :disable="mora.pitch == 0.0"
          :type="'pitch'"
          :clip="false"
          :shiftKeyFlag
          @changeValue="changeMoraData"
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
        <AudioParameter
          v-if="mora.consonant && mora.consonantLength != undefined"
          :moraIndex
          :value="mora.consonantLength"
          :uiLocked
          :min="minMoraLength"
          :max="maxMoraLength"
          :step="0.001"
          :type="'consonant'"
          :clip="true"
          :shiftKeyFlag
          @changeValue="changeMoraData"
          @mouseOver="handleLengthHoverText"
        />
        <!-- vowel length -->
        <AudioParameter
          :moraIndex
          :value="mora.vowelLength"
          :uiLocked
          :min="minMoraLength"
          :max="maxMoraLength"
          :step="0.001"
          :type="'vowel'"
          :clip="mora.consonant ? true : false"
          :shiftKeyFlag
          @changeValue="changeMoraData"
          @mouseOver="handleLengthHoverText"
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
        <AudioParameter
          :moraIndex="accentPhrase.moras.length"
          :value="accentPhrase.pauseMora.vowelLength"
          :uiLocked
          :min="0"
          :max="1.0"
          :step="0.01"
          :type="'pause'"
          :shiftKeyFlag
          @changeValue="changeMoraData"
        />
      </div>
    </template>
    <!-- スライダーここまで -->
    <!-- 読みテキスト・アクセント句の分割と結合ここから -->
    <template v-for="(mora, moraIndex) in accentPhrase.moras" :key="moraIndex">
      <div
        class="text-cell"
        :class="{
          'text-cell-highlighted': isEditableMora(mora.vowel, moraIndex),
        }"
        :style="{
          'grid-column': `${moraIndex * 2 + 1} / span 1`,
        }"
        @mouseover="handleHoverText(true, moraIndex)"
        @mouseleave="handleHoverText(false, moraIndex)"
        @click.stop="uiLocked || handleChangeVoicing(mora, moraIndex)"
      >
        <!-- tooltipを変更する場合、pauseMoraのものも合わせて変更すること-->
        <QTooltip
          v-if="
            selectedDetail === 'pitch' && !unvoicableVowels.includes(mora.vowel)
          "
          :delay="500"
          transitionShow="jump-up"
          transitionHide="jump-down"
          >イ段とウ段以外の音は無声化できません</QTooltip
        >
        <QTooltip
          v-if="selectedDetail === 'length'"
          :delay="500"
          transitionShow="jump-up"
          transitionHide="jump-down"
          >読みの変更はアクセント項目でのみ、<br />無声化はイントネーション項目でのみ操作できます</QTooltip
        >
        <span class="text-cell-inner">
          {{ getHoveredText(mora, moraIndex) }}
        </span>
        <QPopupEdit
          v-if="selectedDetail == 'accent' && !uiLocked"
          v-slot="scope"
          :modelValue="pronunciation"
          autoSave
          transitionShow="none"
          transitionHide="none"
          @save="handleChangePronounce($event)"
        >
          <QInput
            v-model="scope.value"
            dense
            :inputStyle="{
              width: `${scope.value.length + 1}em`,
              minWidth: '50px',
            }"
            :aria-label="`${index + 1}番目のアクセント区間の読み`"
            autofocus
            outlined
            @keyup.enter="scope.set"
          />
        </QPopupEdit>
      </div>
      <div
        v-if="!isLast || moraIndex < accentPhrase.moras.length - 1"
        :class="[
          'splitter-cell',
          {
            'splitter-cell-accent': selectedDetail == 'accent',
            'splitter-cell-be-split':
              moraIndex == accentPhrase.moras.length - 1,
            'splitter-cell-be-split-pause': accentPhrase.pauseMora,
          },
        ]"
        :style="{ 'grid-column': `${moraIndex * 2 + 2} / span 1` }"
        @click.stop="uiLocked || toggleAccentPhraseSplit(false, moraIndex)"
      />
    </template>
    <template v-if="accentPhrase.pauseMora">
      <div class="text-cell">
        <!-- FIXME: 共通化 -->
        <!-- tooltipを変更する場合、pauseMora以外のものも合わせて変更すること-->
        <QTooltip
          v-if="selectedDetail === 'pitch'"
          :delay="500"
          transitionShow="jump-up"
          transitionHide="jump-down"
          >イ段とウ段以外の音は無声化できません</QTooltip
        >
        <QTooltip
          v-if="selectedDetail === 'length'"
          :delay="500"
          transitionShow="jump-up"
          transitionHide="jump-down"
          >読みの変更はアクセント項目でのみ、<br />無声化はイントネーション項目でのみ操作できます</QTooltip
        >
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import AudioAccent from "./AudioAccent.vue";
import AudioParameter from "./AudioParameter.vue";
import { MenuItemButton } from "@/components/Menu/type";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import { useStore } from "@/store";
import { AudioKey, MoraDataType } from "@/type/preload";
import { Mora } from "@/openapi/models/Mora";
import { AccentPhrase } from "@/openapi";

const props = defineProps<{
  audioKey: AudioKey;
  accentPhrase: AccentPhrase;
  index: number;
  isActive: boolean;
  isLast: boolean;
  selectedDetail: DetailTypes;
  shiftKeyFlag: boolean;
  altKeyFlag: boolean;
}>();

defineEmits<{
  (e: "click", index: number): void;
}>();

const container = ref<HTMLElement>();
defineExpose({
  container,
});

type DetailTypes = "accent" | "pitch" | "length";

const store = useStore();

const uiLocked = computed(() => store.getters.UI_LOCKED);

const contextMenudata = ref<[MenuItemButton]>([
  {
    type: "button",
    label: "削除",
    onClick: () => {
      void store.actions.COMMAND_DELETE_ACCENT_PHRASE({
        audioKey: props.audioKey,
        accentPhraseIndex: props.index,
      });
    },
    disableWhenUiLocked: true,
  },
]);

const pronunciation = computed(() => {
  let textString = props.accentPhrase.moras.map((mora) => mora.text).join("");
  if (props.accentPhrase.pauseMora) {
    textString += "、";
  }
  return textString;
});

const handleChangePronounce = (newPronunciation: string) => {
  let popUntilPause = false;
  newPronunciation = newPronunciation
    .replace(/,/g, "、")
    // 連続する読点をまとめる
    .replace(/、{2,}/g, "、");
  if (newPronunciation.endsWith("、")) {
    if (props.isLast) {
      // 末尾の読点を削除
      newPronunciation = newPronunciation.slice(0, -1);
    } else {
      // 生成エラー回避
      newPronunciation += "ア";
      popUntilPause = true;
    }
  }
  void store.actions.COMMAND_CHANGE_SINGLE_ACCENT_PHRASE({
    audioKey: props.audioKey,
    newPronunciation,
    accentPhraseIndex: props.index,
    popUntilPause,
  });
};

const hoveredMoraIndex = ref<number | undefined>(undefined);
const handleHoverText = (isOver: boolean, moraIndex: number) => {
  if (props.selectedDetail == "accent" || props.selectedDetail == "pitch") {
    hoveredMoraIndex.value = isOver ? moraIndex : undefined;
  }
};

const lengthHoveredPhonemeType = ref<"vowel" | "consonant">("vowel");
const handleLengthHoverText = (
  isOver: boolean,
  phoneme: MoraDataType,
  moraIndex: number,
) => {
  if (phoneme !== "vowel" && phoneme !== "consonant")
    throw new Error("phoneme != hoveredType");
  lengthHoveredPhonemeType.value = phoneme;
  // the pause and pitch templates don't emit a mouseOver event
  hoveredMoraIndex.value = isOver ? moraIndex : undefined;
};

const unvoicableVowels = ["U", "I", "i", "u"];

/**
 * 各モーラが、hover中のモーラをそのままクリックした場合に編集範囲に含まれるかどうか。
 * 強調表示するかの判定に使われる。
 */
const isEditableMora = (vowel: string, moraIndex: number) => {
  if (uiLocked.value) {
    return false;
  }
  if (props.selectedDetail == "accent") {
    // クリック時の動作はそのアクセント句の読み変更。
    // よって、いずれかのモーラがhoverされているならそのアクセント句を強調表示する。
    return hoveredMoraIndex.value != undefined;
  }
  if (props.selectedDetail == "pitch") {
    // クリック時の動作は無声化/有声化の切り替え。
    // よって、hover中のモーラが無声化可能かを判定しそのモーラを強調表示する。
    return (
      moraIndex === hoveredMoraIndex.value && unvoicableVowels.includes(vowel)
    );
  }
  return false;
};

const getHoveredText = (mora: Mora, moraIndex: number) => {
  if (props.selectedDetail != "length") return mora.text;
  if (moraIndex === hoveredMoraIndex.value) {
    if (lengthHoveredPhonemeType.value == "vowel") {
      return mora.vowel.toUpperCase();
    } else {
      return mora.consonant?.toUpperCase();
    }
  } else {
    return mora.text;
  }
};

const changeAccent = (accentPhraseIndex: number, accent: number) =>
  store.actions.COMMAND_CHANGE_ACCENT({
    audioKey: props.audioKey,
    accentPhraseIndex,
    accent,
  });
const toggleAccentPhraseSplit = (isPause: boolean, moraIndex?: number) => {
  void store.actions.COMMAND_CHANGE_ACCENT_PHRASE_SPLIT({
    audioKey: props.audioKey,
    accentPhraseIndex: props.index,
    ...(!isPause ? { isPause, moraIndex: moraIndex as number } : { isPause }),
  });
};

const lastPitches = computed(() =>
  props.accentPhrase.moras.map((mora) => mora.pitch),
);

const maxPitch = 6.5;
const minPitch = 3;
const maxMoraLength = 0.3;
const minMoraLength = 0;
const changeMoraData = (
  moraIndex: number,
  data: number,
  type: MoraDataType,
) => {
  const accentPhraseIndex = props.index;
  if (!props.altKeyFlag) {
    if (type == "pitch") {
      lastPitches.value[moraIndex] = data;
    }
    return store.actions.COMMAND_SET_AUDIO_MORA_DATA({
      audioKey: props.audioKey,
      accentPhraseIndex,
      moraIndex,
      data,
      type,
    });
  } else {
    return store.actions.COMMAND_SET_AUDIO_MORA_DATA_ACCENT_PHRASE({
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
    void changeMoraData(moraIndex, data, "voicing");
  }
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.text-cell {
  min-width: 20px;
  max-width: 20px;
  grid-row-start: 3;
  text-align: center;
  white-space: nowrap;
  color: colors.$display;
  position: relative;
  // デフォルトは編集不可
  cursor: not-allowed;
}
.text-cell-inner {
  position: absolute;
  transform: translateX(-50%);
  z-index: 10;
}
.text-cell-highlighted {
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

.accent-phrase {
  display: inline-grid;
  align-self: stretch;
  grid-template-rows: 1fr 60px 30px;

  &:last-child {
    padding-right: 20px;
  }
}

.accent-phrase-hover:hover {
  cursor: pointer;
  background-color: colors.$active-point-hover;
}

.accent-phrase-focus {
  // hover色に負けるので、importantが必要
  background-color: colors.$active-point-focus !important;
}
</style>
