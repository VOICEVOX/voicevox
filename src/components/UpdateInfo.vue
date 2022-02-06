<template>
  <q-page
    ref="scroller"
    class="relative-absolute-wrapper scroller markdown-body"
  >
    <div class="q-pa-md">
      <div v-html="html"></div>
    </div>
  </q-page>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { computed, defineComponent, ref } from "@vue/runtime-core";
import { UpdateInfo } from "../type/preload";

export default defineComponent({
  setup() {
    const store = useStore();

    const infos = ref<UpdateInfo[]>();
    store.dispatch("GET_UPDATE_INFOS").then((obj) => (infos.value = obj));

    const currentVersion = ref("");
    window.electron.getAppInfos().then((obj) => {
      currentVersion.value = obj.version;
    });

    const latestVersion = ref("");
    let tags: string[] = [];
    fetch("https://api.github.com/repos/VOICEVOX/voicevox/releases")
      .then((res) => res.json())
      .then((obj) => {
        obj.map((item: { prerelease: boolean; tag_name: string }) => {
          if (item.prerelease == false) {
            tags.push(item.tag_name);
          }
        });
        latestVersion.value = tags[0];
      });

    const html = computed(() => {
      if (!infos.value) return "";

      let html = "";
      if (currentVersion.value === latestVersion.value) {
        html += `<h3>お使いの VOICEBOX は最新です！</h3>`;
        html += `<hr />`;
      } else {
        html += `<h3>アップデートがあります！</h3>`;
        html += `<p>現在のバージョン：` + currentVersion.value + `</p>`;
        html += `<p>最新のバージョン：` + latestVersion.value + `</p>`;
        html += `<h4>ダウンロードページ</h4>`;
        html += `<a href="https://voicevox.hiroshiba.jp/" target="_blank">https://voicevox.hiroshiba.jp/</a>`;
        html += "<hr />";
      }
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
