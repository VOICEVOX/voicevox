<template>
  <ErrorBoundary>
    <TooltipProvider disableHoverableContent :delayDuration="500">
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
import { watch, onMounted, ref, computed, toRaw, watchEffect } from "vue";
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
import { setFontToCss, setThemeToCss } from "@/domain/dom";
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
watchEffect(() => {
  setFontToCss(store.state.editorFont);
});

// エディタの切り替えを監視してショートカットキーの設定を変更する
watchEffect(
  () => {
    if (openedEditor.value) {
      hotkeyManager.onEditorChange(openedEditor.value);
    }
  },
  { flush: "post" },
);

// テーマの変更を監視してCSS変数を変更する
watchEffect(() => {
  const theme = store.state.availableThemes.find((value) => {
    return value.name == store.state.currentTheme;
  });
  if (theme == undefined) {
    // NOTE: Vuexが初期化されていない場合はまだテーマが読み込まれていないので無視
    if (store.state.isVuexReady) {
      throw Error(`Theme not found: ${store.state.currentTheme}`);
    } else {
      return;
    }
  }
  setThemeToCss(theme);
});

// ソングの再生デバイスを同期
watchEffect(() => {
  void store.actions.APPLY_DEVICE_ID_TO_AUDIO_CONTEXT({
    device: store.state.savingSetting.audioOutputDevice,
  });
});

// ソフトウェアを初期化
const { hotkeyManager } = useHotkeyManager();
const isEnginesReady = ref(false);
const isProjectFileLoaded = ref<boolean | "waiting">("waiting");
onMounted(async () => {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  await store.actions.INIT_VUEX();

  // ショートカットキーの設定を登録
  const hotkeySettings = store.state.hotkeySettings;
  hotkeyManager.load(structuredClone(toRaw(hotkeySettings)));

  // エンジンの初期化開始

  // エンジン情報取得
  await store.actions.PULL_AND_INIT_ENGINE_INFOS();

  // URLパラメータに従ってマルチエンジンをオフにする
  const isMultiEngineOffMode = urlParams.get("isMultiEngineOffMode") === "true";
  void store.actions.SET_IS_MULTI_ENGINE_OFF_MODE(isMultiEngineOffMode);

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
  await store.actions.LOAD_USER_CHARACTER_ORDER();
  await store.actions.POST_ENGINE_START({
    engineIds,
  });

  // 辞書を同期
  await store.actions.SYNC_ALL_USER_DICT();

  isEnginesReady.value = true;

  // エンジン起動後にダイアログを開く
  void store.actions.SET_DIALOG_OPEN({
    isAcceptRetrieveTelemetryDialogOpen:
      store.state.acceptRetrieveTelemetry === "Unconfirmed",
    isAcceptTermsDialogOpen:
      import.meta.env.MODE !== "development" &&
      store.state.acceptTerms !== "Accepted",
  });

  // プロジェクトファイルが指定されていればロード
  const projectFilePath = await store.actions.GET_INITIAL_PROJECT_FILE_PATH();
  if (projectFilePath != undefined) {
    isProjectFileLoaded.value = await store.actions.LOAD_PROJECT_FILE({
      type: "path",
      filePath: projectFilePath,
    });
  } else {
    isProjectFileLoaded.value = false;
  }
});
</script>
