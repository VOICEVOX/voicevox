<template>
  <q-dialog
    maximized
    class="setting-dialog"
    v-model="modelValueComputed"
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-layout container view="lHh Lpr lff" class="bg-white">
      <q-drawer
        bordered
        show-if-above
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
          <q-space />
          <q-list>
            <q-item clickable v-ripple @click="modelValueComputed = false">
              <q-item-section side>
                <q-icon name="keyboard_arrow_left" />
              </q-item-section>
              <q-item-section>オプションを閉じる</q-item-section>
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
              <component :is="page.component" />
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

type Page = {
  name: string;
  component: Component;
};

export default defineComponent({
  name: "SettingDialog",

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

    const pagedata: Page[] = [
      {
        name: "ソフトウェアの利用規約",
        component: Policy,
      },
      {
        name: "音声ライブラリの利用規約",
        component: LibraryPolicy,
      },
      {
        name: "使い方",
        component: HowToUse,
      },
      {
        name: "OSSライセンス情報",
        component: OssLicense,
      },
      {
        name: "アップデート情報",
        component: UpdateInfo,
      },
    ];

    const selectedPage = ref(pagedata[0].name);

    return {
      modelValueComputed,
      pagedata,
      selectedPage,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

.setting-dialog .q-layout-container ::v-deep .absolute-full {
  right: 0 !important;
  .scroll {
    left: unset !important;
    right: unset !important;
    width: unset !important;
    max-height: unset;
  }
}

.selected-item {
  background-color: rgba(global.$primary, 0.4);
  color: global.$secondary;
}
</style>
