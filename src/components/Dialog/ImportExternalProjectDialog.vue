<template>
  <QDialog ref="dialogRef" auto-scroll @before-show="initializeValues">
    <QLayout container view="hHh lpr fFf" class="q-dialog-plugin bg-background">
      <QHeader>
        <QToolbar>
          <QToolbarTitle class="text-display"
            >外部プロジェクトファイルのインポート</QToolbarTitle
          >
        </QToolbar>
      </QHeader>
      <QPageContainer class="q-px-lg q-py-md">
        <QFile
          v-model="midiFile"
          label="インポートするファイル"
          class="q-my-sm"
          :accept="acceptExtensions"
          :error-message="midiFileError"
          :error="!!midiFileError"
          placeholder="外部プロジェクトファイルを選択してください"
          @input="handleFileChange"
        />
        <QSelect
          v-if="project"
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
import {
  Project,
  EmptyProjectException,
  IllegalFileException,
  NotesOverlappingException,
  parseFunctions,
} from "@sevenc-nanashi/utaformatix-ts";
import { useStore } from "@/store";
import { createLogger } from "@/domain/frontend/log";

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const store = useStore();
const log = createLogger("ImportExternalProjectDialog");

// 受け入れる拡張子
const acceptExtensions = computed(() =>
  Object.keys(parseFunctions)
    .map((ext) => `.${ext}`)
    .join(","),
);

// プロジェクトファイル
const midiFile = ref<File | null>(null);
// エラー
const error = ref<
  "emptyProject" | "overlapping" | "parseFailed" | "unknown" | null
>(null);

// ファイルエラー
const midiFileError = computed(() => {
  if (midiFile.value && error.value) {
    switch (error.value) {
      case "emptyProject":
        return "プロジェクトが空です";
      case "overlapping":
        return "ノートが重なっています";
      default:
        return "不明なエラーが発生しました";
    }
  } else if (midiFile.value && project.value) {
    if (!project.value.tracks.length) {
      return "トラックがありません";
    } else if (
      project.value.tracks.every((track) => track.notes.length === 0)
    ) {
      return "ノートがありません";
    }
  }
  return undefined;
});
// データ
const project = ref<Project | null>(null);
// トラック
const tracks = computed(() => {
  if (!project.value) {
    return [];
  }
  // トラックリストを生成
  // "トラックNo: トラック名 / ノート数" の形式で表示
  return project.value.tracks.map((track, index) => ({
    label: `${index + 1}: ${track.name || "（トラック名なし）"} / ノート数：${
      track.notes.length
    }`,
    value: index,
    disable: track.notes.length === 0,
  }));
});
// 選択中のトラック
const selectedTrack = ref<number | null>(null);

// データ初期化
const initializeValues = () => {
  midiFile.value = null;
  project.value = null;
  selectedTrack.value = null;
};

// ファイル変更時
const handleFileChange = async (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) {
    throw new Error("Event target is not an HTMLInputElement");
  }

  const input = event.target;

  // 入力ファイルが存在しない場合はエラー
  if (!input.files || input.files.length === 0) {
    throw new Error("No file selected");
  }

  // 既存のデータおよび選択中のトラックをクリア
  project.value = null;
  selectedTrack.value = null;
  error.value = null;

  const file = input.files[0];
  // ファイルをパース
  try {
    project.value = await Project.fromAny(file);
    selectedTrack.value = project.value.tracks.findIndex(
      (track) => track.notes.length > 0,
    );
    if (selectedTrack.value === -1) {
      selectedTrack.value = 0;
    }
  } catch (e) {
    log.error(String(e));
    error.value = "unknown";
    if (e instanceof EmptyProjectException) {
      error.value = "emptyProject";
    } else if (e instanceof NotesOverlappingException) {
      error.value = "overlapping";
    } else if (e instanceof IllegalFileException) {
      error.value = "parseFailed";
    }
  }
};

// トラックインポート実行時
const handleImportTrack = () => {
  // ファイルまたは選択中のトラックが未設定の場合はエラー
  if (project.value == null || selectedTrack.value == null) {
    throw new Error("project or selected track is not set");
  }
  // トラックをインポート
  store.dispatch("IMPORT_EXTERNAL_PROJECT_FILE", {
    project: project.value,
    trackIndex: selectedTrack.value,
  });
  onDialogOK();
};

// キャンセルボタンクリック時
const handleCancel = () => {
  onDialogCancel();
};
</script>
