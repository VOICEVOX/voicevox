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
  <template
    v-for="(mora, moraIndex) in accentPhrase.moras"
    :key="moraIndex"
  >
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
        uiLocked ||
          handleChangeVoicing(mora, accentPhraseIndex, moraIndex)
      "
    >
      <span class="text-cell-inner">
        {{ getHoveredText(mora, accentPhraseIndex, moraIndex) }}
      </span>
      <q-popup-edit
        v-if="selectedDetail == 'accent' && !uiLocked"
        v-slot="scope"
        :model-value="pronunciationByPhrase[accentPhraseIndex]"
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
          'splitter-cell-be-split':
            moraIndex == accentPhrase.moras.length - 1,
          'splitter-cell-be-split-pause': accentPhrase.pauseMora,
        },
      ]"
      :style="{ 'grid-column': `${moraIndex * 2 + 2} / span 1` }"
      @click.stop="
        uiLocked ||
          toggleAccentPhraseSplit(accentPhraseIndex, false, moraIndex)
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
      class="
        splitter-cell
        splitter-cell-be-split
        splitter-cell-be-split-pause
      "
      @click.stop="
        uiLocked || toggleAccentPhraseSplit(accentPhraseIndex, true)
      "
    />
  </template>
  <!-- 読みテキスト・アクセント句の分割と結合ここまで -->
</template>

<script setup lang="ts">
</script>

<style scoped lang="scss">
</style>
