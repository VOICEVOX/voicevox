<template>
  <div class="detail">
    <BaseScrollArea>
      <div class="inner">
        <h2 class="title">新しい単語の追加</h2>
        <div class="form-row">
          <h3 class="headline">単語</h3>
          <div>単語は全角と半角は区別しません。</div>
          <BaseTextField
            ref="surfaceInput"
            v-model="surface"
            :disabled="uiLocked"
            @enterkeydown="yomiInput?.focus()"
          />
        </div>
        <div class="form-row">
          <h3 class="headline">読み</h3>
          <div>読みに使える文字はひらがなとカタカナのみです。</div>
          <BaseTextField
            ref="yomiInput"
            v-model="yomi"
            :disabled="uiLocked"
            :hasError="false"
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
              :icon="nowPlaying ? 'stop' : 'play_arrow'"
              @click="nowPlaying ? stop() : play()"
            />
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
    <footer class="footer">
      <BaseButton
        :disabled="uiLocked"
        label="キャンセル"
        @click="resetInputs"
      />
      <BaseButton
        :disabled="uiLocked"
        variant="primary"
        label="追加"
        @click="resetInputs"
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

const context = inject(dictionaryManageDialogContextKey);
if (context == undefined)
  throw new Error(`dictionaryManageDialogContext == undefined`);
const { surfaceInput, uiLocked, surface, yomi, wordPriority, resetInputs } =
  context;

const nowPlaying = ref(false);

const play = () => {
  nowPlaying.value = true;
};

const stop = () => {
  nowPlaying.value = false;
};

const yomiInput = ref<typeof BaseTextField>();
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
