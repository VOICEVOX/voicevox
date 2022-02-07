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
import {
  VersionType,
  versionTextParse,
  baseVersionIsLow,
} from "@/store/project";

export default defineComponent({
  setup() {
    const store = useStore();

    const infos = ref<UpdateInfo[]>();
    store.dispatch("GET_UPDATE_INFOS").then((obj) => (infos.value = obj));

    let isCheckingFailed = ref<boolean>(false);

    let isCheckingFinished = ref<boolean>(false);

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
            if (!response.ok) {
              isCheckingFailed.value = true;
            } else {
              return response.json();
            }
          })
          .then((json) => {
            const obj = json.find(
              (item: { prerelease: boolean; tag_name: string }) => {
                return (
                  !item.prerelease &&
                  baseVersionIsLow(
                    versionTextParse(currentVersion.value) as VersionType,
                    versionTextParse(item.tag_name) as VersionType
                  )
                );
              }
            );
            obj ? (latestVersion.value = obj.tag_name) : undefined;
            isCheckingFinished.value = true;
          })
          .catch(() => {
            isCheckingFailed.value = true;
          });
      });

    const isCheckingFailedcomputed = computed(() => {
      return isCheckingFailed.value;
    });

    const isCheckingFinishedComputed = computed(() => {
      return isCheckingFinished.value;
    });

    const isUpdateAvailable = computed(() => {
      return isCheckingFinished.value && latestVersion.value !== "";
    });

    const html = computed(() => {
      if (!infos.value) return "";

      let html = "";

      if (isUpdateAvailable.value) {
        html += `<h3>アップデートがあります！</h3>`;
        html += `<h4>最新版のダウンロードページ</h4>`;
        html += `<a href="https://voicevox.hiroshiba.jp/" target="_blank">https://voicevox.hiroshiba.jp/</a>`;
      } else if (isCheckingFinishedComputed.value && !isUpdateAvailable.value) {
        html += `<h3>お使いの VOICEBOX は最新です！</h3>`;
      } else if (
        !isCheckingFinishedComputed.value &&
        !isCheckingFailedcomputed.value
      ) {
        html += `<h3>アップデートを確認中です…</h3>`;
      } else {
        html += `<h3>アップデートの確認に失敗しました…</h3>`;
      }

      html += `<hr />`;
      html += `<h3>アップデート履歴</h3>`;

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
