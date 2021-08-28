<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar>
        <q-toolbar-title class="text-secondary"
          >アップデート情報</q-toolbar-title
        >
      </q-toolbar>
    </q-header>
    <q-page ref="scroller" class="relarive-absolute-wrapper scroller">
      <div class="q-pa-md">
        <div v-html="html"></div>
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
    :deep() {
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
