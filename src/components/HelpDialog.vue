<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="help-dialog"
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
                    <q-breadcrumbs
                      class="text-display"
                      active-color="display"
                      style="font-size: 20px"
                    >
                      <q-breadcrumbs-el :label="t('help_dialog.root')" />
                      <q-breadcrumbs-el :label="page.name" />
                    </q-breadcrumbs>
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
                <component :is="page.component" />
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
import { MessageSchema } from "@/i18n";
import { useI18n } from "vue-i18n";

type Page = {
  name: string;
  component: Component;
};

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

    const { t } = useI18n<{ message: MessageSchema }>({
      useScope: "global",
    });

    const pagedata: Page[] = [
      {
        name: t("help_dialog.policy"),
        component: Policy,
      },
      {
        name: t("help_dialog.library_policy"),
        component: LibraryPolicy,
      },
      {
        name: t("help_dialog.how_to_use"),
        component: HowToUse,
      },
      {
        name: t("help_dialog.community"),
        component: OssCommunityInfo,
      },
      {
        name: t("help_dialog.license"),
        component: OssLicense,
      },
      {
        name: t("help_dialog.release_note"),
        component: UpdateInfo,
      },
    ];

    const selectedPage = ref(pagedata[0].name);

    return {
      modelValueComputed,
      pagedata,
      selectedPage,
      t,
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
