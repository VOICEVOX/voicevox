<template>
  <q-dialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="help-dialog transparent-backdrop"
    v-model="modelValueComputed"
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
                clickable
                v-ripple
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
              <div class="root">
                <q-header class="q-pa-sm">
                  <q-toolbar>
                    <q-toolbar-title class="text-display">
                      ヘルプ / {{ page.parent ? page.parent + " / " : ""
                      }}{{ page.name }}
                    </q-toolbar-title>
                    <!-- close button -->
                    <q-btn
                      round
                      flat
                      icon="close"
                      color="display"
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

<script lang="ts">
import { defineComponent, computed, ref, Component } from "vue";
import HelpPolicy from "@/components/HelpPolicy.vue";
import LibraryPolicy from "@/components/LibraryPolicy.vue";
import HowToUse from "@/components/HowToUse.vue";
import OssLicense from "@/components/OssLicense.vue";
import UpdateInfo from "@/components/UpdateInfo.vue";
import OssCommunityInfo from "@/components/OssCommunityInfo.vue";
import QAndA from "@/components/QAndA.vue";
import ContactInfo from "@/components/ContactInfo.vue";
import semver from "semver";
import { UpdateInfo as UpdateInfoObject } from "../type/preload";
import { useStore } from "@/store";
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

export default defineComponent({
  name: "HelpDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const modelValueComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    // エディタのアップデート確認
    const store = useStore();

    const updateInfos = ref<UpdateInfoObject[]>();
    store.dispatch("GET_UPDATE_INFOS").then((obj) => (updateInfos.value = obj));

    const isCheckingFinished = ref<boolean>(false);

    // 最新版があるか調べる
    const currentVersion = ref("");
    const latestVersion = ref("");
    window.electron
      .getAppInfos()
      .then((obj) => {
        currentVersion.value = obj.version;
      })
      .then(() => {
        fetch("https://api.github.com/repos/VOICEVOX/voicevox/releases", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        })
          .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok.");
            return response.json();
          })
          .then((json) => {
            const newerVersion = json.find(
              (item: { prerelease: boolean; tag_name: string }) => {
                return (
                  !item.prerelease &&
                  semver.valid(currentVersion.value) &&
                  semver.valid(item.tag_name) &&
                  semver.lt(currentVersion.value, item.tag_name)
                );
              }
            );
            if (newerVersion) {
              latestVersion.value = newerVersion.tag_name;
            }
            isCheckingFinished.value = true;
          })
          .catch((err) => {
            throw new Error(err);
          });
      });

    const isUpdateAvailable = computed(() => {
      return isCheckingFinished.value && latestVersion.value !== "";
    });

    // エディタのOSSライセンス取得
    const licenses = ref<Record<string, string>[]>();
    store.dispatch("GET_OSS_LICENSES").then((obj) => (licenses.value = obj));

    const policy = ref<string>();
    store.dispatch("GET_POLICY_TEXT").then((obj) => (policy.value = obj));

    const pagedata = computed(() =>
      (
        [
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
              updateInfos: updateInfos.value,
              isUpdateAvailable: isUpdateAvailable.value,
              latestVersion: latestVersion.value,
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
        ] as PageData[]
      ).concat(
        // エンジンが一つだけの場合は従来の表示のみ
        (store.state.engineIds.length > 1
          ? Object.values(store.state.engineManifests)
          : []
        ).flatMap((manifest) => [
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
        ])
      )
    );

    const selectedPageIndex = ref(0);

    return {
      modelValueComputed,
      pagedata,
      selectedPageIndex,
    };
  },
});
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
