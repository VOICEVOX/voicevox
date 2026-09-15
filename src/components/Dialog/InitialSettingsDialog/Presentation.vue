<template>
  <BaseDialog
    v-model="dialogOpened"
    title="どちらに興味がありますか？"
    description="興味のあるエディターを選んでください。"
    persistent
  >
    <div class="editor-options">
      <button
        type="button"
        class="editor-option"
        aria-label="トーク"
        aria-describedby="talk-description"
        @click="emit('select', 'talk')"
      >
        <QIcon name="record_voice_over" size="3rem" aria-hidden="true" />
        <span class="editor-name">トーク</span>
        <span id="talk-description" class="editor-description">
          文章を入力して、音声を作成します。
        </span>
      </button>

      <button
        type="button"
        class="editor-option"
        aria-label="ソング"
        aria-describedby="song-description"
        @click="emit('select', 'song')"
      >
        <QIcon name="music_note" size="3rem" aria-hidden="true" />
        <span class="editor-name">ソング</span>
        <span id="song-description" class="editor-description">
          音符と歌詞を入力して、歌声を作成します。
        </span>
      </button>
    </div>

    <p class="switching-note">
      選択後も画面右上からトークとソングを切り替えられます。
    </p>
  </BaseDialog>
</template>

<script setup lang="ts">
import BaseDialog from "@/components/Base/BaseDialog.vue";
import type { EditorType } from "@/type/preload";

const dialogOpened = defineModel<boolean>({ default: false });
const emit = defineEmits<{
  select: [editor: EditorType];
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.editor-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: vars.$gap-2;
}

.editor-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 168px;
  padding: vars.$padding-2;
  gap: vars.$gap-1;
  color: colors.$display;
  background-color: colors.$control;
  border: 1px solid colors.$border;
  border-radius: vars.$radius-2;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  cursor: pointer;

  &:hover {
    background-color: colors.$control-hovered;
  }

  &:active {
    background-color: colors.$control-pressed;
    box-shadow: none;
  }

  &:focus-visible {
    @include mixin.on-focus;
  }
}

.editor-name {
  @include mixin.headline-2;
}

.editor-description {
  color: colors.$display-sub;
  line-height: 1.5;
  text-align: center;
}

.switching-note {
  margin: 0;
  color: colors.$display-sub;
  line-height: 1.5;
}

@media (max-width: 480px) {
  .editor-options {
    grid-template-columns: 1fr;
  }

  .editor-option {
    min-height: auto;
  }
}
</style>
