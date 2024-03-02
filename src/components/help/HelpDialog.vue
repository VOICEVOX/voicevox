<template>
  <q-dialog
    v-model="modelValueComputed"
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="help-dialog transparent-backdrop"
  >
    <q-layout container view="hHh Lpr lff">
      <q-drawer
        bordered
        show-if-above
        class="bg-background"
        :model-value="true"
        :width="250"
        :breakpoint="0"
      >
        <div class="column full-height">
          <q-list>
            <template v-for="(page, pageIndex) of pagedata" :key="pageIndex">
              <q-item
                v-if="page.type === 'item'"
                v-ripple
                clickable
                active-class="selected-item"
                :active="selectedPageIndex === pageIndex"
                @click="selectedPageIndex = pageIndex"
              >
                <q-item-section> {{ page.name }} </q-item-section>
              </q-item>
              <template v-else-if="page.type === 'separator'">
                <q-separator />
                <q-item-label header>{{ page.name }}</q-item-label>
              </template>
            </template>
          </q-list>
        </div>
      </q-drawer>

      <q-page-container>
        <q-page>
          <q-tab-panels v-model="selectedPageIndex">
            <q-tab-panel
              v-for="(page, pageIndex) of pagedata"
              :key="pageIndex"
              :name="pageIndex"
              class="q-pa-none"
            >
              <div v-if="page.type === 'item'" class="root">
                <q-header class="q-pa-sm">
                  <q-toolbar>
                    <q-toolbar-title class="text-display">
                      ヘルプ / {{ page.parent ? page.parent + " / " : ""
                      }}{{ page.name }}
                    </q-toolbar-title>
                    <q-btn
                      v-if="page.shouldShowOpenLogDirectoryButton"
                      unelevated
                      color="toolbar-button"
                      text-color="toolbar-button-display"
                      class="text-no-wrap text-bold q-mr-sm"
                      @click="openLogDirectory"
                    >
                      ログフォルダを開く
                    </q-btn>
                    <!-- close button -->
                    <q-btn
                      round
                      flat
                      icon="close"
                      color="display"
                      aria-label="ヘルプを閉じる"
                      @click="modelValueComputed = false"
                    />
                  </q-toolbar>
                </q-header>
                <component :is="page.component" v-bind="page.props" />
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import MarkdownView from "../template/HelpMarkdownViewSection.vue";
import OssLicense from "../template/HelpOssLicenseSection.vue";
import UpdateInfo from "../template/HelpUpdateInfoSection.vue";
import LibraryPolicy from "../template/HelpLibraryPolicySection.vue";
import { UpdateInfo as UpdateInfoObject } from "@/type/preload";
import { useStore } from "@/store";
import { useFetchNewUpdateInfos } from "@/composables/useFetchNewUpdateInfos";

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

const props =
  defineProps<{
    modelValue: boolean;
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", val: boolean): void;
  }>();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

// エディタのアップデート確認
const store = useStore();

const updateInfos = ref<UpdateInfoObject[]>();
store.dispatch("GET_UPDATE_INFOS").then((obj) => (updateInfos.value = obj));

const { isCheckingFinished, latestVersion } = useFetchNewUpdateInfos();

const isUpdateAvailable = computed(() => {
  return isCheckingFinished.value && latestVersion.value !== "";
});

// エディタのOSSライセンス取得
const licenses = ref<Record<string, string>[]>();
store.dispatch("GET_OSS_LICENSES").then((obj) => (licenses.value = obj));

const policy = ref<string>();
store.dispatch("GET_POLICY_TEXT").then((obj) => (policy.value = obj));

const howToUse = ref<string>();
store.dispatch("GET_HOW_TO_USE_TEXT").then((obj) => (howToUse.value = obj));

const ossCommunityInfos = ref<string>();
store.dispatch("GET_OSS_COMMUNITY_INFOS").then((obj) => (ossCommunityInfos.value = obj));

const qAndA = ref<string>();
store.dispatch("GET_Q_AND_A_TEXT").then((obj) => (qAndA.value = obj));

const contact = ref<string>();
store.dispatch("GET_CONTACT_TEXT").then((obj) => (contact.value = obj));

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
        isUpdateAvailable: isUpdateAvailable.value,
        latestVersion: latestVersion.value,
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
        store.dispatch("LOG_WARN", `manifest not found: ${id}`);
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
        }
      );
    }
  }
  return data;
});

const selectedPageIndex = ref(0);

const openLogDirectory = window.electron.openLogDirectory;
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

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
