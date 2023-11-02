import { ref } from "vue";
import semver from "semver";
import { UpdateInfo } from "@/type/preload";

// 最新版があるか調べる
// 現バージョンより新しい最新版があれば`latestVersion`に代入される
export const useFetchNewUpdateInfos = () => {
  const isCheckingFinished = ref<boolean>(false);
  const currentVersion = ref("");
  const latestVersion = ref("");
  const newUpdateInfos = ref<UpdateInfo[]>([]);

  window.electron
    .getAppInfos()
    .then((obj) => {
      currentVersion.value = obj.version;
    })
    .then(() => {
      // TODO: URLを環境変数で変えられるようにする
      fetch(
        "https://raw.githubusercontent.com/VOICEVOX/voicevox_blog/master/src/data/updateInfos.json"
      )
        .then((response) => {
          if (!response.ok) throw new Error("Network response was not ok.");
          return response.json();
        })
        .then((json) => {
          newUpdateInfos.value = json.filter((item: UpdateInfo) => {
            return semver.lt(currentVersion.value, item.version);
          });
          if (newUpdateInfos.value?.length) {
            latestVersion.value = newUpdateInfos.value[0].version;
          }
          isCheckingFinished.value = true;
        });
    });

  return {
    isCheckingFinished,
    latestVersion,
    newUpdateInfos,
  };
};
