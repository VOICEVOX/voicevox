<template>
  <ErrorBoundary>
    <TooltipProvider disableHoverableContent>
      <MenuBar
        v-if="openedEditor != undefined"
        :fileSubMenuData="subMenuData.fileSubMenuData.value"
        :editSubMenuData="subMenuData.editSubMenuData.value"
        :viewSubMenuData="subMenuData.viewSubMenuData.value"
        :editor="openedEditor"
      />
      <KeepAlive>
        <Component
          :is="openedEditor == 'talk' ? TalkEditor : SingEditor"
          v-if="openedEditor != undefined"
          :key="openedEditor"
          :isEnginesReady
          :isProjectFileLoaded
        />
      </KeepAlive>
      <AllDialog :isEnginesReady />
    </TooltipProvider>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { watch, onMounted, ref, computed, toRaw } from "vue";
import { useGtm } from "@gtm-support/vue-gtm";
import { TooltipProvider } from "radix-vue";
import TalkEditor from "@/components/Talk/TalkEditor.vue";
import SingEditor from "@/components/Sing/SingEditor.vue";
import { EngineId } from "@/type/preload";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { useStore } from "@/store";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import AllDialog from "@/components/Dialog/AllDialog.vue";
import MenuBar from "@/components/Menu/MenuBar/MenuBar.vue";
import { useMenuBarData as useTalkMenuBarData } from "@/components/Talk/menuBarData";
import { useMenuBarData as useSingMenuBarData } from "@/components/Sing/menuBarData";
import { setFont, themeToCss } from "@/domain/dom";
import { ExhaustiveError } from "@/type/utility";

const store = useStore();

const talkMenuBarData = useTalkMenuBarData();
const singMenuBarData = useSingMenuBarData();

const subMenuData = computed(() => {
  if (openedEditor.value === "talk" || openedEditor.value == undefined) {
    return talkMenuBarData;
  } else if (openedEditor.value === "song") {
    return singMenuBarData;
  }

  throw new ExhaustiveError(openedEditor.value);
});

const openedEditor = computed(() => store.state.openedEditor);

// Google Tag Manager
const gtm = useGtm();
watch(
  () => store.state.acceptRetrieveTelemetry,
  (acceptRetrieveTelemetry) => {
    gtm?.enable(acceptRetrieveTelemetry === "Accepted");
  },
  { immediate: true },
);

// フォントの制御用パラメータを変更する
watch(
  () => store.state.editorFont,
  (editorFont) => {
    setFont(editorFont);
  },
  { immediate: true },
);

// エディタの切り替えを監視してショートカットキーの設定を変更する
watch(
  () => store.state.openedEditor,
  async (openedEditor) => {
    if (openedEditor != undefined) {
      hotkeyManager.onEditorChange(openedEditor);
    }
  },
);

// テーマの変更を監視してCSS変数を変更する
watch(
  () =>
    [
      store.state.currentTheme,
      store.state.availableThemes,
      store.state.isVuexReady,
    ] as const,
  ([currentTheme, availableThemes, isVuexReady]) => {
    const theme = availableThemes.find((value) => {
      return value.name == currentTheme;
    });

    if (theme == undefined) {
      // NOTE: Vuexが初期化されていない場合はまだテーマが読み込まれていないので無視
      if (isVuexReady) {
        throw Error(`Theme not found: ${currentTheme}`);
      } else {
        return;
      }
    }

    themeToCss(theme);
  },
  { immediate: true },
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
  const projectFilePath = urlParams.get("projectFilePath");

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
  void store.dispatch("SET_IS_MULTI_ENGINE_OFF_MODE", isMultiEngineOffMode);

  // マルチエンジンオフモードのときはデフォルトエンジンだけにする
  let engineIds: EngineId[];
  if (isMultiEngineOffMode) {
    const main = Object.values(store.state.engineInfos).find(
      (engine) => engine.isDefault,
    );
    if (!main) {
      throw new Error("No default engine found");
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
  void store.dispatch("SET_DIALOG_OPEN", {
    isAcceptRetrieveTelemetryDialogOpen:
      store.state.acceptRetrieveTelemetry === "Unconfirmed",
    isAcceptTermsDialogOpen:
      import.meta.env.MODE !== "development" &&
      store.state.acceptTerms !== "Accepted",
  });

  // プロジェクトファイルが指定されていればロード
  if (typeof projectFilePath === "string" && projectFilePath !== "") {
    isProjectFileLoaded.value = await store.dispatch("LOAD_PROJECT_FILE", {
      filePath: projectFilePath,
    });
  } else {
    isProjectFileLoaded.value = false;
  }
});
</script>
