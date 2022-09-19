<template>
  <q-page
    ref="scroller"
    class="relative-absolute-wrapper scroller markdown-body"
  >
    <div class="q-pa-md">
      <template v-if="isUpdateAvailable">
        <h3>最新バージョン {{ latestVersion }} が見つかりました</h3>
        <a href="https://voicevox.hiroshiba.jp/" target="_blank"
          >ダウンロードページ</a
        >
        <hr />
      </template>
      <h3>アップデート履歴</h3>
      <template v-for="(info, i) of updateInfos" :key="i">
        <h3>バージョン {{ info.version }}</h3>
        <ul>
          <template v-for="(item, j) of info.descriptions" :key="j">
            <li>{{ item }}</li>
          </template>
        </ul>
        <h4>貢献者リスト</h4>
        <p>
          <template v-for="(item, j) of info.contributors" :key="j">
            <span v-if="j > 0"> / </span>
            <a :href="`https://github.com/${item}`" target="_blank">{{
              item
            }}</a>
          </template>
        </p>
      </template>
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
            const newerVersion = json.find(
              (item: { prerelease: boolean; tag_name: string }) => {
                return (
                  !item.prerelease &&
                  semver.valid(currentVersion.value) &&
                  semver.valid(item.tag_name) &&
                  semver.lt(currentVersion.value, item.tag_name)
                );
              }
            );
            if (newerVersion) {
              latestVersion.value = newerVersion.tag_name;
            }
            isCheckingFinished.value = true;
          })
          .catch((err) => {
            throw new Error(err);
          });
      });

    const isUpdateAvailable = computed(() => {
      return isCheckingFinished.value && latestVersion.value !== "";
    });

    return {
      isUpdateAvailable,
      latestVersion,
      updateInfos,
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
