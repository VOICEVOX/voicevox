<template>
  <QDialog ref="dialogRef" @beforeShow="initializeValues">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">インポート</div>
      </QCardSection>

      <QSeparator />

      <QCardSection class="q-py-none">
        <QFile
          v-model="projectFile"
          label="インポートするファイル"
          class="q-my-sm"
          :accept="acceptExtensions"
          :errorMessage="projectFileErrorMessage"
          :error="!!projectFileErrorMessage"
          placeholder="ファイルを選択してください"
          @input="handleFileChange"
        />
        <div v-if="projectFile == null">
          <span class="text-weight-bold">対応しているファイル形式</span>
          <ul>
            <li
              v-for="[name, extensions] in projectNameToExtensions"
              :key="name"
            >
              {{ name }}：{{ extensions.map((ext) => `.${ext}`).join("、") }}
            </li>
          </ul>
        </div>
      </QCardSection>
      <QCardSection v-if="trackOptions.length > 0">
        <QList bordered class="rounded-borders scroll scrollable-area">
          <QItem
            v-for="(track, index) in trackOptions"
            :key="track.value"
            tag="label"
            :disable="track.disable"
          >
            <QItemSection avatar>
              <QCheckbox
                v-model="selectedTrackIndexes"
                :val="track.value"
                :disable="track.disable"
              />
            </QItemSection>
            <QItemSection>
              <QItemLabel>
                {{ index + 1 }}：{{ track.name || DEFAULT_TRACK_NAME }}
              </QItemLabel>
              <QItemLabel caption>ノート数：{{ track.noteLength }}</QItemLabel>
            </QItemSection>
          </QItem>
        </QList>
      </QCardSection>

      <QSeparator />

      <QCardActions>
        <QSpace />
        <QBtn
          unelevated
          align="right"
          label="キャンセル"
          color="toolbar-button"
          textColor="toolbar-button-display"
          class="text-no-wrap text-bold q-mr-sm"
          @click="handleCancel"
        />
        <QBtn
          unelevated
          align="right"
          label="インポート"
          color="toolbar-button"
          textColor="toolbar-button-display"
          class="text-no-wrap text-bold q-mr-sm"
          :disabled="
            selectedTrackIndexes == null ||
            selectedTrackIndexes.length === 0 ||
            projectFileErrorMessage != undefined
          "
          @click="handleImportTrack"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useDialogPluginComponent } from "quasar";
import {
  Project as UfProject,
  EmptyProjectException,
  IllegalFileException,
  NotesOverlappingException,
  supportedExtensions,
  SupportedExtensions as UfSupportedExtensions,
} from "@sevenc-nanashi/utaformatix-ts";
import { useStore } from "@/store";
import { createLogger } from "@/helpers/log";
import { ExhaustiveError } from "@/type/utility";
import { IsEqual } from "@/type/utility";
import { LatestProjectType } from "@/domain/project/schema";
import { DEFAULT_TRACK_NAME } from "@/sing/domain";

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const store = useStore();
const log = createLogger("ImportExternalProjectDialog");

// 受け入れる拡張子
const acceptExtensions = computed(
  () => supportedExtensions.map((ext) => `.${ext}`).join(",") + ",.vvproj",
);

type SupportedExtensions = UfSupportedExtensions | "vvproj";

// VOICEVOX形式、汎用的な形式、その他の形式の順。それぞれはアルファベット順。
const projectNameToExtensions = [
  ["VOICEVOX", ["vvproj"]],
  ["MIDI (SMF)", ["mid"]],
  ["MusicXML", ["xml", "musicxml"]],
  ["CeVIO", ["ccs"]],
  ["DeepVocal", ["dv"]],
  ["OpenUtau", ["ustx"]],
  ["Piapro Studio", ["ppsf"]],
  ["Synthesizer V", ["s5p", "svp"]],
  ["UtaFormatix", ["ufdata"]],
  ["UTAU", ["ust"]],
  ["VOCALOID", ["vpr", "vsq", "vsqx"]],
  ["VoiSona", ["tssln"]],
] as const satisfies [string, SupportedExtensions[]][];

// ちゃんと全部の拡張子があるかチェック
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _: IsEqual<
  (typeof projectNameToExtensions)[number][1][number],
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

// エラーメッセージ
const projectFileErrorMessage = computed(() => {
  if (!projectFile.value) {
    return undefined;
  }
  if (error.value) {
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
  } else if (project.value) {
    const tracks = getProjectTracks(project.value);
    if (tracks.length === 0) {
      return "トラックがありません";
    } else if (tracks.every((track) => track.noteLength === 0)) {
      return "ノートがありません";
    }
  }

  return undefined;
});

type Project =
  | {
      type: "utaformatix";
      project: UfProject;
    }
  | {
      type: "vvproj";
      project: LatestProjectType;
    };

// データ
const project = ref<Project | null>(null);

// トラック
function getProjectTracks(project: Project) {
  function toTrack(name: string | undefined, noteLength: number) {
    return { name, noteLength, disable: noteLength === 0 };
  }
  return project.type === "utaformatix"
    ? project.project.tracks.map((track) =>
        toTrack(track.name, track.notes.length),
      )
    : project.project.song.trackOrder.map((trackId) =>
        toTrack(
          // zodが何故かundefinedを入れてくるので、null-safe operatorを使う
          project.project.song.tracks[trackId]?.name,
          project.project.song.tracks[trackId]?.notes.length ?? 0,
        ),
      );
}

// 選択用のトラック
const trackOptions = computed(() => {
  if (!project.value) {
    return [];
  }
  // トラックリストを生成
  const tracks = getProjectTracks(project.value);
  return tracks.map((track, index) => ({
    name: track?.name,
    noteLength: track.noteLength,
    value: index,
    disable: track.disable,
  }));
});
// 選択中のトラック
const selectedTrackIndexes = ref<number[] | null>(null);

// データ初期化
const initializeValues = () => {
  projectFile.value = null;
  project.value = null;
  selectedTrackIndexes.value = null;
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
  selectedTrackIndexes.value = null;
  error.value = null;

  const file = input.files[0];
  // ファイルをパース
  try {
    if (file.name.endsWith(".vvproj")) {
      const vvproj = await file.text();
      const parsedProject = await store.actions.PARSE_PROJECT_FILE({
        projectJson: vvproj,
      });
      project.value = {
        type: "vvproj",
        project: parsedProject,
      };
    } else {
      project.value = {
        type: "utaformatix",
        project: await UfProject.fromAny(file, {
          defaultLyric: "",
        }),
      };
    }
    const firstSelectableTrack = getProjectTracks(project.value).findIndex(
      (track) => !track.disable,
    );
    if (firstSelectableTrack === -1) {
      error.value = "emptyProject";
      return;
    }
    selectedTrackIndexes.value = [firstSelectableTrack];
  } catch (e) {
    log.error(e);
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
  if (project.value == null || selectedTrackIndexes.value == null) {
    throw new Error("project or selected track is not set");
  }
  // トラックをインポート
  const trackIndexes = selectedTrackIndexes.value.toSorted((a, b) => a - b);
  if (project.value.type === "vvproj") {
    void store.actions.COMMAND_IMPORT_VOICEVOX_PROJECT({
      project: project.value.project,
      trackIndexes,
    });
  } else {
    void store.actions.COMMAND_IMPORT_UTAFORMATIX_PROJECT({
      project: project.value.project,
      trackIndexes,
    });
  }
  onDialogOK();
};

// キャンセルボタンクリック時
const handleCancel = () => {
  onDialogCancel();
};
</script>

<style scoped lang="scss">
.scrollable-area {
  overflow-y: auto;
  max-height: calc(100vh - 100px - 295px);
}
</style>
