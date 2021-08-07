<template>
  <div class="root">
    <mcw-top-app-bar class="main-toolbar">
      <div class="mdc-top-app-bar__row">
        <section
          class="mdc-top-app-bar__section mdc-top-app-bar__section--align-start"
        >
          <span class="mdc-top-app-bar__title">アップデート情報</span>
        </section>
      </div>
    </mcw-top-app-bar>
    <div
      ref="scroller"
      class="scroller mdc-top-app-bar--fixed-adjust relarive-absolute-wrapper"
    >
      <div>
        <div v-html="html"></div>
      </div>
    </div>
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

        html += `<h4>貢献者リスト</h4>`;
        html += `<p>${contributors.join(" / ")}</p>`;
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
  width: 100%;
  display: flex;
  flex-direction: column;
}

.scroller {
  width: 100%;
  overflow: auto;
  > div {
    margin: 1rem;
  }
}
</style>
