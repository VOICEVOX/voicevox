<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar>
        <q-toolbar-title class="text-secondary"
          >アップデート情報</q-toolbar-title
        >
      </q-toolbar>
    </q-header>
    <q-page ref="scroller" class="relative-absolute-wrapper scroller">
      <div class="q-pa-md">
        <div v-html="html" v-for="n in 15" :key="n"></div>
        <q-card class="setting-card">
          <q-card-section class="bg-amber">
            <div class="text-h5">Restore Default</div>
            <div class="text-subtitle2">
              Current setting <b>except</b> <br />Engine Mode will be lost
            </div>
          </q-card-section>

          <q-separator />

          <q-toggle v-model="unlock" label="I understand" color="amber" />
          <q-card-actions align="right">
            <q-btn
              :disable="!unlock"
              color="amber"
              text-color="black"
              @click="resetSetting"
            >
              Restore
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
    </q-page>
  </div>
</template>

<script lang="ts">
import { useStore, GET_UPDATE_INFOS } from "@/store";
import { computed, defineComponent, ref } from "@vue/runtime-core";

export default defineComponent({
  setup() {
    const store = useStore();

    const infos = ref<Record<string, any>[]>();
    store.dispatch(GET_UPDATE_INFOS).then((obj) => (infos.value = obj));

    const html = computed(() => {
      if (!infos.value) return "";

      let html = "";
      for (const info of infos.value) {
        const version: string = info.version;
        const descriptions: string[] = info.descriptions;
        const contributors: string[] = info.contributors;

        html += `<h3>バージョン ${version}</h3>`;

        html += `<ul>`;
        for (const description of descriptions) {
          html += `<li>${description}</li>`;
        }
        html += `</ul>`;

        if (contributors.length > 0) {
          html += `<h4>貢献者リスト</h4>`;
          html += `<p>${contributors.join(" / ")}</p>`;
        }
      }

      return html;
    });

    return {
      html,
    };
  },
});
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
    ::v-deep {
      h3 {
        font-size: 1.3rem;
        font-weight: bold;
        margin: 0;
      }
      h4 {
        font-size: 1.1rem;
        font-weight: bold;
        margin: 0;
      }
    }
  }
}
</style>
