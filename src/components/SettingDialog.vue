<template>
  <q-dialog maximized class="help-dialog" v-model="modelValueComputed">
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
import { Component, defineComponent } from "vue";
import { useStore } from "@/store";
import { settingStore } from "@/store/setting";

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

  setup() {
    const store = useStore();
    
  }
});
</script>