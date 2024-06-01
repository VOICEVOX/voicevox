<template>
  <QDialog ref="dialogRef" auto-scroll @before-show="initializeValues">
    <QLayout container view="hHh lpr fFf" class="q-dialog-plugin bg-background">
      <QHeader>
        <QToolbar>
          <QToolbarTitle class="text-display"
            >プロジェクトファイルのインポート</QToolbarTitle
          >
        </QToolbar>
      </QHeader>
      <QPageContainer class="q-px-lg q-py-md">
        以下のプロジェクトファイルをインポートできます：
        <ul>
          <li v-for="(extensions, name) in projectNameToExtensions" :key="name">
            {{ name }}：{{ extensions.map((ext) => `.${ext}`).join("、") }}
          </li>
        </ul>
        <QFile
          v-model="projectFile"
          label="インポートするファイル"
          class="q-my-sm"
          :accept="acceptExtensions"
          :error-message="projectFileError"
          :error="!!projectFileError"
          placeholder="外部プロジェクトファイルを選択してください"
          @input="handleFileChange"
        />
        <QSelect
          v-if="project"
          v-model="selectedTrack"
          :options="tracks"
          :disable="projectFileError != undefined"
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
            :disabled="selectedTrack === null || projectFileError != undefined"
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
  supportedExtensions,
  SupportedExtensions as UfSupportedExtensions,
} from "@sevenc-nanashi/utaformatix-ts";
import semver from "semver";
import { useStore } from "@/store";
import { createLogger } from "@/domain/frontend/log";
import { readTextFile } from "@/helpers/fileReader";
import { migrateProjectFileObject } from "@/domain/project";
import { ExhaustiveError } from "@/type/utility";
import { songProjectToUfData } from "@/sing/songProjectToUfData";
import { IsEqual } from "@/type/utility";

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const store = useStore();
const log = createLogger("ImportExternalProjectDialog");

// 受け入れる拡張子
const acceptExtensions = computed(
  () => supportedExtensions.map((ext) => `.${ext}`).join(",") + ",.vvproj",
);

type SupportedExtensions = UfSupportedExtensions | "vvproj";

const projectNameToExtensions = {
  "Cevio AI": ["ccs"],
  DeepVocal: ["dv"],
  MusicXML: ["xml", "musicxml"],
  "Piapro Studio": ["ppsf"],
  "SMF (MIDI)": ["mid"],
  "Synthesizer V": ["s5p", "svp"],
  UTAU: ["ust"],
  OpenUtau: ["ustx"],
  VOCALOID: ["vpr", "vsq", "vsqx"],
  VOICEVOX: ["vvproj"],
} as const satisfies Record<string, SupportedExtensions[]>;

// ちゃんと全部の拡張子があるかチェック
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _: IsEqual<
  (typeof projectNameToExtensions)[keyof typeof projectNameToExtensions][number],
  SupportedExtensions
> = true;

// プロジェクトファイル
const projectFile = ref<File | null>(null);
// エラー
const error = ref<
  | "emptyProject"
  | "overlapping"
  | "parseFailed"
  | "oldProject"
  | "unknown"
  | null
>(null);

// ファイルエラー
const projectFileError = computed(() => {
  if (projectFile.value && error.value) {
    switch (error.value) {
      case "emptyProject":
        return "プロジェクトが空です";
      case "overlapping":
        return "ノートが重なっています";
      case "parseFailed":
        return "ファイルの解析に失敗しました";
      case "oldProject":
        return "古いプロジェクトファイルです";
      case "unknown":
        return "不明なエラーが発生しました";
    }

    throw new ExhaustiveError(error.value);
  } else if (projectFile.value && project.value) {
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
  projectFile.value = null;
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
    if (file.name.endsWith(".vvproj")) {
      const vvproj = JSON.parse(await readTextFile(file));
      if (
        !(
          "appVersion" in vvproj &&
          semver.satisfies(vvproj["appVersion"], ">=0.17", {
            includePrerelease: true,
          })
        )
      ) {
        error.value = "oldProject";
        return;
      }
      const migratedVvproj = await migrateProjectFileObject(vvproj, {
        // DIされている関数は0.17からは使われないので適当な関数を渡す。
        // TODO: だとしても不安なのでちゃんとした関数を渡す？
        fetchMoraData: () => {
          throw new Error("fetchMoraData is not implemented");
        },
        characterInfos: [],
      });
      project.value = new Project(songProjectToUfData(migratedVvproj.song));
    } else {
      project.value = await Project.fromAny(file);
    }
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
