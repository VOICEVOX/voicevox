<template>
  <QDialog ref="dialogRef" auto-scroll @before-show="initializeValues">
    <QLayout container view="hHh lpr fFf" class="q-dialog-plugin bg-background">
      <QHeader>
        <QToolbar>
          <QToolbarTitle class="text-display"
            >MIDIファイルのインポート</QToolbarTitle
          >
        </QToolbar>
      </QHeader>
      <QPageContainer class="q-px-lg q-py-md">
        <QFile
          v-model="midiFile"
          label="インポートするMIDIファイル"
          class="q-my-sm"
          accept=".mid,.midi"
          :error-message="midiFileError"
          :error="!!midiFileError"
          placeholder="MIDIファイルを選択してください"
          @input="handleMidiFileChange"
        />
        <QSelect
          v-if="midi"
          v-model="selectedTrack"
          :options="tracks"
          :disable="midiFileError != undefined"
          emit-value
          map-options
          label="インポートするトラック"
        />
      </QPageContainer>
      <QFooter>
        <QToolbar>
          <QSpace />
          <QBtn
            unelevated
            align="right"
            label="キャンセル"
            color="toolbar-button"
            text-color="toolbar-button-display"
            class="text-no-wrap text-bold q-mr-sm"
            @click="handleCancel"
          />
          <QBtn
            unelevated
            align="right"
            label="インポート"
            color="toolbar-button"
            text-color="toolbar-button-display"
            class="text-no-wrap text-bold q-mr-sm"
            :disabled="selectedTrack === null || midiFileError != undefined"
            @click="handleImportTrack"
          />
        </QToolbar>
      </QFooter>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import { Midi } from "@/sing/midi";
import { useStore } from "@/store";

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const store = useStore();

// MIDIファイル
const midiFile = ref<File | null>(null);

// MIDIファイルエラー
const midiFileError = computed(() => {
  if (midiFile.value && !midi.value) {
    return "MIDIファイルの読み込みに失敗しました";
  } else if (midiFile.value && midi.value) {
    if (!midi.value.tracks.length) {
      return "トラックがありません";
    } else if (midi.value.tracks.every((track) => track.notes.length === 0)) {
      return "ノートがありません";
    }
  }
  return undefined;
});
// MIDIデータ
const midi = ref<Midi | null>(null);
// トラック
const tracks = computed(() => {
  if (!midi.value) {
    return [];
  }
  // トラックリストを生成
  // "トラックNo: トラック名 / ノート数" の形式で表示
  return midi.value.tracks.map((track, index) => ({
    label: `${index + 1}: ${track.name || "（トラック名なし）"} / ノート数：${
      track.notes.length
    }`,
    value: index,
    disable: track.notes.length === 0,
  }));
});
// 選択中のトラック
const selectedTrack = ref<string | number | null>(null);

// データ初期化
const initializeValues = () => {
  midiFile.value = null;
  midi.value = null;
  selectedTrack.value = null;
};

// MIDIファイル変更時
const handleMidiFileChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    throw new Error("Event target is not an HTMLInputElement");
  }

  const input = event.target;

  // 入力ファイルが存在しない場合はエラー
  if (!input.files || input.files.length === 0) {
    throw new Error("No file selected");
  }

  // 既存のMIDIデータおよび選択中のトラックをクリア
  midi.value = null;
  selectedTrack.value = null;

  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      if (
        e.target &&
        e.target.result &&
        e.target.result instanceof ArrayBuffer
      ) {
        // MIDIファイルをパース
        midi.value = new Midi(e.target.result);
        selectedTrack.value = midi.value.tracks.findIndex(
          (track) => track.notes.length > 0,
        );
        if (selectedTrack.value === -1) {
          selectedTrack.value = 0;
        }
      } else {
        throw new Error("Could not find MIDI file data");
      }
    } catch (error) {
      throw new Error("Failed to parse MIDI file", { cause: error });
    }
  };
  reader.onerror = () => {
    throw new Error("Failed to read MIDI file");
  };

  // MIDIファイルをバイナリデータとして読み込む
  reader.readAsArrayBuffer(file);
};

// トラックインポート実行時
const handleImportTrack = () => {
  // MIDIファイルまたは選択中のトラックが未設定の場合はエラー
  if (midiFile.value == null || typeof selectedTrack.value !== "number") {
    throw new Error("MIDI file or selected track is not set");
  }
  // トラックをインポート
  store.dispatch("IMPORT_MIDI_FILE", {
    filePath: midiFile.value.path,
    trackIndex: selectedTrack.value,
  });
  onDialogOK();
};

// キャンセルボタンクリック時
const handleCancel = () => {
  onDialogCancel();
};
</script>
