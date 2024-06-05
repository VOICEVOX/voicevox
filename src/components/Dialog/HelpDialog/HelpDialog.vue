<template>
  <QDialog
    v-model="modelValueComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="help-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff">
      <QDrawer
        bordered
        showIfAbove
        class="bg-background"
        :modelValue="true"
        :width="250"
        :breakpoint="0"
      >
        <div class="column full-height">
          <QList>
            <template v-for="(page, pageIndex) of pagedata" :key="pageIndex">
              <QItem
                v-if="page.type === 'item'"
                v-ripple
                clickable
                activeClass="selected-item"
                :active="selectedPageIndex === pageIndex"
                @click="selectedPageIndex = pageIndex"
              >
                <QItemSection> {{ page.name }} </QItemSection>
              </QItem>
              <template v-else-if="page.type === 'separator'">
                <QSeparator />
                <QItemLabel header>{{ page.name }}</QItemLabel>
              </template>
            </template>
          </QList>
        </div>
      </QDrawer>

      <QPageContainer>
        <QPage>
          <QTabPanels v-model="selectedPageIndex">
            <QTabPanel
              v-for="(page, pageIndex) of pagedata"
              :key="pageIndex"
              :name="pageIndex"
              class="q-pa-none"
            >
              <div v-if="page.type === 'item'" class="root">
                <QHeader class="q-pa-sm">
                  <QToolbar>
                    <QToolbarTitle class="text-display">
                      ヘルプ / {{ page.parent ? page.parent + " / " : ""
                      }}{{ page.name }}
                    </QToolbarTitle>
                    <QBtn
                      v-if="page.component === ContactInfo"
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
                      @click="modelValueComputed = false"
                    />
                  </QToolbar>
                </QHeader>
                <Component :is="page.component" v-bind="page.props" />
              </div>
            </QTabPanel>
          </QTabPanels>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { Component } from "vue";
import HelpPolicy from "./HelpPolicy.vue";
import LibraryPolicy from "./LibraryPolicy.vue";
import HowToUse from "./HowToUse.vue";
import OssLicense from "./OssLicense.vue";
import UpdateInfo from "./UpdateInfo.vue";
import OssCommunityInfo from "./OssCommunityInfo.vue";
import QAndA from "./QAndA.vue";
import ContactInfo from "./ContactInfo.vue";
import { UpdateInfo as UpdateInfoObject, UrlString } from "@/type/preload";
import { useStore } from "@/store";
import { useFetchNewUpdateInfos } from "@/composables/useFetchNewUpdateInfos";
import { createLogger } from "@/domain/frontend/log";

type PageItem = {
  type: "item";
  name: string;
  parent?: string;
  component: Component;
  props?: Record<string, unknown>;
};
type PageSeparator = {
  type: "separator";
  name: string;
};
type PageData = PageItem | PageSeparator;

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

// エディタのアップデート確認
const store = useStore();
const { warn } = createLogger("HelpDialog");

const updateInfos = ref<UpdateInfoObject[]>();
store.dispatch("GET_UPDATE_INFOS").then((obj) => (updateInfos.value = obj));

if (!import.meta.env.VITE_LATEST_UPDATE_INFOS_URL) {
  throw new Error(
    "環境変数VITE_LATEST_UPDATE_INFOS_URLが設定されていません。.envに記載してください。",
  );
}
const newUpdateResult = useFetchNewUpdateInfos(
  () => window.backend.getAppInfos().then((obj) => obj.version), // アプリのバージョン
  UrlString(import.meta.env.VITE_LATEST_UPDATE_INFOS_URL),
);

// エディタのOSSライセンス取得
const licenses = ref<Record<string, string>[]>();
store.dispatch("GET_OSS_LICENSES").then((obj) => (licenses.value = obj));

const policy = ref<string>();
store.dispatch("GET_POLICY_TEXT").then((obj) => (policy.value = obj));

const pagedata = computed(() => {
  const data: PageData[] = [
    {
      type: "item",
      name: "ソフトウェアの利用規約",
      component: HelpPolicy,
      props: {
        policy: policy.value,
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
      component: HowToUse,
    },
    {
      type: "item",
      name: "開発コミュニティ",
      component: OssCommunityInfo,
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
              latestVersion: undefined,
            }),
      },
    },
    {
      type: "item",
      name: "よくあるご質問",
      component: QAndA,
    },
    {
      type: "item",
      name: "お問い合わせ",
      component: ContactInfo,
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
          component: HelpPolicy,
          props: {
            policy: manifest.termsOfService,
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

const openLogDirectory = window.backend.openLogDirectory;
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.help-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  .scroll {
    left: unset !important;
    right: unset !important;
    width: unset !important;
    max-height: unset;
  }
}

.selected-item {
  background-color: rgba(colors.$primary-rgb, 0.4);
  color: colors.$display;
}

.q-item__label {
  padding: 8px 16px;
}
</style>
