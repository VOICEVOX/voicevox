<template>
  <QDialog
    ref="dialogRef"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="help-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff">
      <QPageContainer>
        <QHeader class="q-pa-sm">
          <QToolbar>
            <QToolbarTitle class="text-display">
              ヘルプ /
              {{ selectedPage.parent ? selectedPage.parent + " / " : ""
              }}{{ selectedPage.name }}
            </QToolbarTitle>
            <QBtn
              v-if="selectedPage.shouldShowOpenLogDirectoryButton"
              unelevated
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap text-bold q-mr-sm"
              @click="openLogDirectory"
            >
              ログフォルダを開く
            </QBtn>
            <!-- close button -->
            <QBtn
              round
              flat
              icon="close"
              color="display"
              aria-label="ヘルプを閉じる"
              @click="onDialogOK"
            />
          </QToolbar>
        </QHeader>
        <BaseNavigationView>
          <template #sidebar>
            <template v-for="(page, pageIndex) of pagedata" :key="pageIndex">
              <BaseListItem
                v-if="page.type === 'item'"
                :selected="selectedPageIndex === pageIndex"
                @click="selectedPageIndex = pageIndex"
              >
                {{ page.name }}
              </BaseListItem>
              <div v-else-if="page.type === 'separator'" class="list-label">
                {{ page.name }}
              </div>
            </template>
          </template>
          <QTabPanels v-model="selectedPageIndex">
            <QTabPanel
              v-for="(page, pageIndex) of pagedata"
              :key="pageIndex"
              :name="pageIndex"
              class="q-pa-none"
            >
              <Component
                :is="page.component"
                v-if="page.type === 'item'"
                v-bind="page.props"
              />
            </QTabPanel>
          </QTabPanels>
        </BaseNavigationView>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Component } from "vue";
import { useDialogPluginComponent } from "quasar";
import MarkdownView from "./HelpMarkdownViewSection.vue";
import OssLicense from "./HelpOssLicenseSection.vue";
import UpdateInfo from "./HelpUpdateInfoSection.vue";
import LibraryPolicy from "./HelpLibraryPolicySection.vue";
import BaseListItem from "@/components/Base/BaseListItem.vue";
import BaseNavigationView from "@/components/Base/BaseNavigationView.vue";
import { UpdateInfo as UpdateInfoObject, UrlString } from "@/type/preload";
import { useStore } from "@/store";
import { useFetchNewUpdateInfos } from "@/composables/useFetchNewUpdateInfos";
import { createLogger } from "@/helpers/log";
import { getAppInfos } from "@/domain/appInfo";

type PageItem = {
  type: "item";
  name: string;
  parent?: string;
  component: Component;
  props?: Record<string, unknown>;
  shouldShowOpenLogDirectoryButton?: boolean;
};
type PageSeparator = {
  type: "separator";
  name: string;
};
type PageData = PageItem | PageSeparator;

const { dialogRef, onDialogOK } = useDialogPluginComponent();

// エディタのアップデート確認
const store = useStore();
const { warn } = createLogger("HelpDialog");

const updateInfos = ref<UpdateInfoObject[]>();
void store.actions.GET_UPDATE_INFOS().then((obj) => (updateInfos.value = obj));

if (!import.meta.env.VITE_LATEST_UPDATE_INFOS_URL) {
  throw new Error(
    "環境変数VITE_LATEST_UPDATE_INFOS_URLが設定されていません。.envに記載してください。",
  );
}
const newUpdateResult = useFetchNewUpdateInfos(
  () => getAppInfos().version,
  UrlString(import.meta.env.VITE_LATEST_UPDATE_INFOS_URL),
);

// エディタのOSSライセンス取得
const licenses = ref<Record<string, string>[]>();
void store.actions.GET_OSS_LICENSES().then((obj) => (licenses.value = obj));

const policy = ref<string>("");
void store.actions.GET_POLICY_TEXT().then((obj) => (policy.value = obj));

const howToUse = ref<string>("");
void store.actions.GET_HOW_TO_USE_TEXT().then((obj) => (howToUse.value = obj));

const ossCommunityInfos = ref<string>("");
void store.actions
  .GET_OSS_COMMUNITY_INFOS()
  .then((obj) => (ossCommunityInfos.value = obj));

const qAndA = ref<string>("");
void store.actions.GET_Q_AND_A_TEXT().then((obj) => (qAndA.value = obj));

const contact = ref<string>("");
void store.actions.GET_CONTACT_TEXT().then((obj) => (contact.value = obj));

const pagedata = computed(() => {
  const data: PageData[] = [
    {
      type: "item",
      name: "ソフトウェアの利用規約",
      component: MarkdownView,
      props: {
        markdown: policy.value,
      },
    },
    {
      type: "item",
      name: "音声ライブラリの利用規約",
      component: LibraryPolicy,
    },
    {
      type: "item",
      name: "使い方",
      component: MarkdownView,
      props: {
        markdown: howToUse.value,
      },
    },
    {
      type: "item",
      name: "開発コミュニティ",
      component: MarkdownView,
      props: {
        markdown: ossCommunityInfos.value,
      },
    },
    {
      type: "item",
      name: "ライセンス情報",
      component: OssLicense,
      props: {
        licenses: licenses.value,
      },
    },
    {
      type: "item",
      name: "アップデート情報",
      component: UpdateInfo,
      props: {
        downloadLink: import.meta.env.VITE_OFFICIAL_WEBSITE_URL,
        updateInfos: updateInfos.value,
        ...(newUpdateResult.value.status == "updateAvailable"
          ? {
              isUpdateAvailable: true,
              latestVersion: newUpdateResult.value.latestVersion,
            }
          : {
              isUpdateAvailable: false,
              latestVersion: "",
            }),
      },
    },
    {
      type: "item",
      name: "よくあるご質問",
      component: MarkdownView,
      props: {
        markdown: qAndA.value,
      },
    },
    {
      type: "item",
      name: "お問い合わせ",
      component: MarkdownView,
      props: {
        markdown: contact.value,
      },
      shouldShowOpenLogDirectoryButton: true,
    },
  ];
  // エンジンが一つだけの場合は従来の表示のみ
  if (store.state.engineIds.length > 1) {
    for (const id of store.getters.GET_SORTED_ENGINE_INFOS.map((m) => m.uuid)) {
      const manifest = store.state.engineManifests[id];
      if (!manifest) {
        warn(`manifest not found: ${id}`);
        continue;
      }

      data.push(
        {
          type: "separator",
          name: manifest.name,
        },
        {
          type: "item",
          name: "利用規約",
          parent: manifest.name,
          component: MarkdownView,
          props: {
            markdown: manifest.termsOfService,
          },
        },
        {
          type: "item",
          name: "ライセンス情報",
          parent: manifest.name,
          component: OssLicense,
          props: {
            licenses: manifest.dependencyLicenses,
          },
        },
        {
          type: "item",
          name: "アップデート情報",
          parent: manifest.name,
          component: UpdateInfo,
          props: {
            updateInfos: manifest.updateInfos,
            // TODO: エンジン側で最新バージョンチェックAPIが出来たら実装する。
            //       https://github.com/VOICEVOX/voicevox_engine/issues/476
            isUpdateAvailable: false,
          },
        },
      );
    }
  }
  return data;
});

const selectedPageIndex = ref(0);

const selectedPage = computed(() => {
  if (pagedata.value[selectedPageIndex.value].type == "item") {
    return pagedata.value[selectedPageIndex.value] as PageItem;
  } else {
    throw new Error("selectedPageにはPageItem型の値を指定してください。");
  }
});

const openLogDirectory = () => window.backend.openLogDirectory();
</script>

<style scoped lang="scss">
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/variables" as vars;

.list-label {
  padding: vars.$padding-2;
  padding-bottom: vars.$padding-1;
  color: colors.$display-sub;
}

.help-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  .scroll {
    left: unset !important;
    right: unset !important;
    width: unset !important;
    max-height: unset;
  }
}

.q-tab-panels {
  display: contents;
}
</style>
