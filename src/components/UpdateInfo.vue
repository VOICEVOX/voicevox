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
import semver from "semver";

export default defineComponent({
  setup() {
    const store = useStore();

    const updateInfos = ref<UpdateInfo[]>();
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
            const obj = json.find(
              (item: { prerelease: boolean; tag_name: string }) => {
                return (
                  !item.prerelease &&
                  semver.valid(currentVersion.value) &&
                  semver.valid(item.tag_name) &&
                  semver.lt(currentVersion.value, item.tag_name)
                );
              }
            );
            obj ? (latestVersion.value = obj.tag_name) : undefined;
            isCheckingFinished.value = true;
          })
          .catch((err) => {
            throw new Error(err);
          });
      });

    const isUpdateAvailable = computed(() => {
      return isCheckingFinished.value && latestVersion.value !== "";
    });

    const html = computed(() => {
      if (!updateInfos.value) return "";

      let html = "";

      if (isUpdateAvailable.value) {
        html += `<h3>最新バージョン ${latestVersion.value} が見つかりました</h3>`;
        html += `<a href="https://voicevox.hiroshiba.jp/" target="_blank">ダウンロードページ</a>`;
      }

      html += `<hr />`;
      html += `<h3>アップデート履歴</h3>`;

      for (const info of updateInfos.value) {
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
