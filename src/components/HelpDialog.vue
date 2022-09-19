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
            <q-item
              v-for="(page, i) of pagedata"
              :key="i"
              clickable
              v-ripple
              active-class="selected-item"
              :active="selectedPage === page.name"
              @click="selectedPage = page.name"
            >
              <q-item-section>{{ page.name }}</q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-drawer>

      <q-page-container>
        <q-page>
          <q-tab-panels v-model="selectedPage">
            <q-tab-panel
              v-for="(page, i) of pagedata"
              :key="i"
              :name="page.name"
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
                <component :is="page.component" :v-if="page.type === 'item'" />
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
type PageItem = {
  type: "item";
  name: string;
  component: Component;
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

    const pagedata = computed(
      () =>
        [
          {
            type: "separator",
            name: "VOICEVOX エディタ",
          },
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
        ].concat([
          /* TODO: エンジン毎に項目を追加する */
        ]) as PageData[]
    );

    const selectedPage = ref(pagedata.value[0].name);

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
</style>
