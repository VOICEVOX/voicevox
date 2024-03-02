<template>
  <ErrorBoundary>
    <!-- TODO: メニューバーをEditorHomeから移動する -->
    <KeepAlive>
      <Component
        :is="openedEditor == 'talk' ? TalkEditor : SingEditor"
        v-if="openedEditor != undefined"
        :key="openedEditor"
        :is-engines-ready="isEnginesReady"
        :is-project-file-loaded="isProjectFileLoaded"
      />
    </KeepAlive>
    <AllDialog :is-engines-ready="isEnginesReady" />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { watch, onMounted, ref, computed, toRaw } from "vue";
import { useGtm } from "@gtm-support/vue-gtm";
import TalkEditor from "@/components/Talk/TalkEditor.vue";
import SingEditor from "@/components/Sing/SingEditor.vue";
import { EngineId } from "@/type/preload";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { useStore } from "@/store";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import AllDialog from "@/components/Dialog/AllDialog.vue";

const store = useStore();

const openedEditor = computed(() => store.state.openedEditor);

/**
 * 読み込むプロジェクトファイルのパス。
 * undefinedのときは何も読み込むべきものがない。
 */
const projectFilePath = ref<string | undefined>(undefined);

// Google Tag Manager
const gtm = useGtm();
watch(
  () => store.state.acceptRetrieveTelemetry,
  (acceptRetrieveTelemetry) => {
    gtm?.enable(acceptRetrieveTelemetry === "Accepted");
  },
  { immediate: true }
);

// フォントの制御用パラメータを変更する
watch(
  () => store.state.editorFont,
  (editorFont) => {
    document.body.setAttribute("data-editor-font", editorFont);
  },
  { immediate: true }
);

// エディタの切り替えを監視してショートカットキーの設定を変更する
watch(
  () => store.state.openedEditor,
  async (openedEditor) => {
    if (openedEditor != undefined) {
      hotkeyManager.onEditorChange(openedEditor);
    }
  }
);

// ソフトウェアを初期化
const { hotkeyManager } = useHotkeyManager();
const isEnginesReady = ref(false);
const isProjectFileLoaded = ref<boolean | "waiting">("waiting");
onMounted(async () => {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  await store.dispatch("INIT_VUEX");

  // プロジェクトファイルのパスを取得
  const _projectFilePath = urlParams.get("projectFilePath");
  if (_projectFilePath != undefined && _projectFilePath !== "") {
    projectFilePath.value = _projectFilePath;
  }

  // どちらのエディタを開くか設定
  await store.dispatch("SET_OPENED_EDITOR", { editor: "talk" });

  // ショートカットキーの設定を登録
  const hotkeySettings = store.state.hotkeySettings;
  hotkeyManager.load(structuredClone(toRaw(hotkeySettings)));

  // エンジンの初期化開始

  // エンジン情報取得
  await store.dispatch("GET_ENGINE_INFOS");

  // URLパラメータに従ってマルチエンジンをオフにする
  const isMultiEngineOffMode = urlParams.get("isMultiEngineOffMode") === "true";
  store.dispatch("SET_IS_MULTI_ENGINE_OFF_MODE", isMultiEngineOffMode);

  // マルチエンジンオフモードのときはデフォルトエンジンだけにする
  let engineIds: EngineId[];
  if (isMultiEngineOffMode) {
    const main = Object.values(store.state.engineInfos).find(
      (engine) => engine.type === "default"
    );
    if (!main) {
      throw new Error("No main engine found");
    }
    engineIds = [main.uuid];
  } else {
    engineIds = store.state.engineIds;
  }
  await store.dispatch("LOAD_USER_CHARACTER_ORDER");
  await store.dispatch("POST_ENGINE_START", {
    engineIds,
  });

  // 辞書を同期
  await store.dispatch("SYNC_ALL_USER_DICT");

  isEnginesReady.value = true;

  // エンジン起動後にダイアログを開く
  store.dispatch("SET_DIALOG_OPEN", {
    isAcceptRetrieveTelemetryDialogOpen:
      store.state.acceptRetrieveTelemetry === "Unconfirmed",
    isAcceptTermsDialogOpen:
      import.meta.env.MODE !== "development" &&
      store.state.acceptTerms !== "Accepted",
  });

  // プロジェクトファイルが指定されていればロード
  if (
    typeof projectFilePath.value === "string" &&
    projectFilePath.value !== ""
  ) {
    isProjectFileLoaded.value = await store.dispatch("LOAD_PROJECT_FILE", {
      filePath: projectFilePath.value,
    });
  } else {
    isProjectFileLoaded.value = false;
  }
});
</script>
