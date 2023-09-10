<template>
  <q-dialog
    v-model="modelValueComputed"
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="transparent-backdrop"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title class="text-display"
              >音声ライブラリのインストール</q-toolbar-title
            >
          </div>

          <q-space />

          <div class="row items-center no-wrap">
            <q-btn
              unelevated
              label="戻る"
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap q-mr-md"
              :disable="isInstallInProgress"
              @click="backToManageDialog"
            />
            <q-btn
              unelevated
              label="利用規約に同意してインストール"
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap"
              :disable="isInstallInProgress"
              @click="installLibrary"
            />
          </div>
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page class="main">
          <div v-if="isInstallInProgress" class="loading">
            <div
              v-if="
                selectedLibraryData &&
                libraryInstallStatuses[selectedLibraryData.libraryId].status ===
                  'downloading'
              "
            >
              <q-circular-progress
                show-value
                font-size="0.5rem"
                :value="downloadProgress"
                size="2.5rem"
                color="primary"
              >
                {{ downloadProgress ? downloadProgress.toFixed(1) : "" }}%
              </q-circular-progress>
              <div class="q-mt-xs">ダウンロード中・・・</div>
            </div>
            <div v-else>
              <q-spinner color="primary" size="2.5rem" />
              <div class="q-mt-xs">
                {{
                  selectedLibraryData &&
                  libraryInstallStatuses[selectedLibraryData.libraryId] &&
                  libraryInstallStatuses[selectedLibraryData.libraryId]
                    .status === "installing"
                    ? "インストール中・・・"
                    : "インストール待機中・・・"
                }}
              </div>
            </div>
          </div>
          <div class="q-px-md q-pt-md">
            <span class="text-h5 text-bold">
              各話者・キャラクターの利用規約をお読みください。
            </span>
          </div>
          <div class="markdown-body">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="markdown q-pa-md" v-html="policyHtml" />
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";
import { EngineId } from "@/type/preload";

const props =
  defineProps<{
    modelValue: boolean;
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", val: boolean): void;
  }>();

const store = useStore();

const backToManageDialog = () => {
  store.dispatch("SET_DIALOG_OPEN", { isLibraryManageDialogOpen: true });
  modelValueComputed.value = false;
};

const libraryInstallStatuses = computed(
  () => store.state.libraryInstallStatuses
);
const downloadProgress = computed(() => {
  // ダウンロード状態ではない場合はundefinedにする
  if (!selectedLibraryData.value) return undefined;
  const libraryId = selectedLibraryData.value.libraryId;
  const status = libraryInstallStatuses.value[libraryId];
  if (status.status !== "downloading") return undefined;
  // contentLengthが0になる場合のための処理
  if (status.contentLength === 0) {
    return (status.downloaded / selectedLibraryData.value.librarySize) * 100;
  }
  return (status.downloaded / status.contentLength) * 100;
});

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const isInstallInProgress = computed(() => {
  if (!selectedLibraryData.value)
    throw Error("selectedLibraryData.value === undefined");
  const libraryId = selectedLibraryData.value.libraryId;
  return (
    libraryInstallStatuses.value[libraryId] &&
    (libraryInstallStatuses.value[libraryId].status === "pending" ||
      libraryInstallStatuses.value[libraryId].status === "downloading" ||
      libraryInstallStatuses.value[libraryId].status === "installing")
  );
});

// 選択中のライブラリ情報
const selectedLibraryData = computed(() => store.state.selectedLibrary);

const installLibrary = async () => {
  const library = selectedLibraryData.value;
  if (!library) throw Error("selectedLibraryData.value === undefined");
  const result = await store.dispatch("START_LIBRARY_DOWNLOAD_AND_INSTALL", {
    engineId: library.engineId,
    libraryId: library.libraryId,
    libraryName: library.libraryName,
    libraryDownloadUrl: library.libraryDownloadUrl,
    librarySize: library.librarySize,
  });
  if (result.ok) {
    await requireReload(
      `${library.libraryName}をインストールしました。反映には再読み込みが必要です。今すぐ再読み込みしますか？`,
      library.engineId
    );
  } else {
    // インストール失敗時はmainプロセス側でダイアログが出るので
    // そのままライブラリ管理画面に戻る
    backToManageDialog();
  }
};

const requireReload = async (message: string, engineId: EngineId) => {
  const result = await store.dispatch("SHOW_WARNING_DIALOG", {
    title: "再読み込みが必要です",
    message: message,
    actionName: "再読み込み",
    cancel: "後で",
  });
  await store.dispatch("SET_LIBRARY_FETCH_STATUS", {
    engineId,
    status: "reloadNeeded",
  });
  if (result === "OK") {
    store.dispatch("CHECK_EDITED_AND_NOT_SAVE", {
      closeOrReload: "reload",
    });
  } else {
    backToManageDialog();
  }
};

const md = useMarkdownIt();
const policyHtml = computed(() => {
  let result = "";
  const libraryData = selectedLibraryData.value;
  if (!libraryData) {
    throw Error("selectedLibraryData == undefined");
  }
  for (const characterInfo of libraryData.characterInfos) {
    result += md.render(characterInfo.metas.policy);
  }
  return result;
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-toolbar div:first-child {
  min-width: 0;
}
.library-portrait-wrapper {
  display: grid;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  .library-portrait {
    margin: auto;
  }
}

.main {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width}
  );
  width: 100%;
  overflow-y: scroll;
  > div {
    width: 100%;
  }
}

.loading {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$background;
    border-radius: 6px;
    padding: 14px;
  }
}

.library-items-container {
  padding: 5px 16px;

  flex-grow: 1;

  display: flex;
  flex-direction: column;

  cursor: pointer;

  .library-header {
    display: flex;
    flex-direction: row;
    width: 100%;
    align-items: center;

    > .library-title {
      margin-right: auto;
    }

    > .library-manage-buttons {
      display: flex;
      flex-direction: row;

      justify-content: center;
      margin-left: auto;
    }
  }

  > div.q-circular-progress {
    margin: auto;
  }
  > div.library-list {
    display: flex;
    flex-direction: column;
    margin: 0 10px;
    align-content: center;
    justify-content: center;
    // deepをつけないとdisableになったときにUIが崩壊する
    :deep(.library-item) {
      margin: 10px 0;
      box-shadow: 0 0 0 1px rgba(colors.$primary-light-rgb, 0.5);
      border-radius: 10px;
      overflow: hidden;
      &.selected-library-item {
        box-shadow: 0 0 0 2px colors.$primary-light;
      }
      &:hover :deep(.q-focus-helper) {
        opacity: 0 !important;
      }
      .library-item-inner {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;

        .speaker-list {
          display: flex;
          flex-direction: row;
          overflow-x: auto;
          margin-left: auto;
          margin-right: auto;
          margin-bottom: 20px;
          max-width: 90%;

          .speaker-card {
            height: vars.$character-item-size;
            margin: 10px;
            grid-auto-rows: vars.$character-item-size;
            min-width: vars.$character-item-size;
          }
        }
      }
    }
  }
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

@media screen and (max-width: 880px) {
  .q-drawer-container {
    display: none;
  }
  .q-page-container {
    padding-left: unset !important;
    .q-page-sticky {
      left: 0 !important;
    }
  }
}
</style>
