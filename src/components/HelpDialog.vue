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
            <template v-for="(page, i) of pagedata" :key="i">
              <q-item
                v-if="page.type === 'item'"
                clickable
                v-ripple
                active-class="selected-item"
                :active="selectedPage === i"
                @click="selectedPage = i"
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
          <q-tab-panels v-model="selectedPage">
            <q-tab-panel
              v-for="(page, i) of pagedata"
              :key="i"
              :name="i"
              class="q-pa-none"
            >
              <div class="root">
                <q-header class="q-pa-sm">
                  <q-toolbar>
                    <q-toolbar-title class="text-display">
                      ヘルプ / {{ page.name }}
                    </q-toolbar-title>
                    <q-space />
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
import Policy from "@/components/Policy.vue";
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

    // Voicevoxのアップデート確認
    const store = useStore();

    const updateInfos = ref<UpdateInfoObject[]>();
    store.dispatch("GET_UPDATE_INFOS").then((obj) => (updateInfos.value = obj));

    let isCheckingFinished = ref<boolean>(false);

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

    const pagedata = computed(() =>
      (
        [
          {
            type: "item",
            name: "ソフトウェアの利用規約",
            component: Policy,
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
        Object.values(store.state.engineManifests).flatMap((manifest) => [
          {
            type: "separator",
            name: manifest.name,
          },
          {
            type: "item",
            name: "アップデート情報",
            component: UpdateInfo,
            props: {
              updateInfos: manifest.updateInfos,
              // TODO: エンジン側で最新バージョンのチェックを実装したい。
              //       /update_availableみたいなエンドポイントがあれば良さそう
              isUpdateAvailable: false,
            },
          } /* TODO: エンジン毎に項目を追加する */,
        ])
      )
    );

    const selectedPage = ref(1);

    return {
      modelValueComputed,
      pagedata,
      selectedPage,
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
