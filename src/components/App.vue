<template>
  <error-boundary>
    <!-- TODO: メニューバーをEditorHomeから移動する -->
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component
          :is="Component"
          :is-engines-ready="isEnginesReady"
          :project-file-path="projectFilePath"
        />
      </keep-alive>
    </router-view>
  </error-boundary>
</template>

<script setup lang="ts">
import { watch, onMounted, ref, computed } from "vue";
import { useGtm } from "@gtm-support/vue-gtm";
import { useRoute } from "vue-router";
import Mousetrap from "mousetrap";
import { EngineId } from "@/type/preload";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { useStore } from "@/store";
import { isOnCommandOrCtrlKeyDown } from "@/store/utility";

const store = useStore();
const route = useRoute();

// TODO: プロジェクトファイルの読み込みもEditorHomeから移動する
const projectFilePath = computed(() => route.query["projectFilePath"]);

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

// ソフトウェアを初期化
const isEnginesReady = ref(false);
onMounted(async () => {
  await store.dispatch("INIT_VUEX");

  // Electronのデフォルトのundo/redoを無効化
  const disableDefaultUndoRedo = (event: KeyboardEvent) => {
    // ctrl+z, ctrl+shift+z, ctrl+y
    if (
      isOnCommandOrCtrlKeyDown(event) &&
      (event.key == "z" || (!event.shiftKey && event.key == "y"))
    ) {
      event.preventDefault();
    }
  };
  document.addEventListener("keydown", disableDefaultUndoRedo);

  // ショートカットキー操作を止める条件の設定
  // 止めるなら`true`を返す
  Mousetrap.prototype.stopCallback = (
    e: Mousetrap.ExtendedKeyboardEvent, // 未使用
    element: Element,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    combo: string // 未使用
  ) => {
    return (
      element.tagName === "INPUT" ||
      element.tagName === "SELECT" ||
      element.tagName === "TEXTAREA" ||
      (element instanceof HTMLElement && element.contentEditable === "true") ||
      // メニュー項目ではショートカットキーを無効化
      element.classList.contains("q-item")
    );
  };

  // エンジンの初期化開始

  // エンジン情報取得
  await store.dispatch("GET_ENGINE_INFOS");

  // URLパラメータに従ってマルチエンジンをオフにする
  const isMultiEngineOffMode = route.query["isMultiEngineOffMode"] === "true";
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
});

// TODO: ダイアログ周りをEditorHomeから移動する

// TODO: エンジン起動状態周りの処理と表示をEditorHomeから移動する
</script>
