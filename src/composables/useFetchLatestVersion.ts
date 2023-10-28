import { ref } from "vue";
import semver from "semver";
import { UpdateInfo as UpdateInfoObject } from "@/type/preload";

// 最新版があるか調べる
export const useFetchLatestVersion = () => {
  const isCheckingFinished = ref<boolean>(false);
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

  return { isCheckingFinished, latestVersion };
};

// 最新の更新情報を取得する
export const useFetchLatestUpdateInfos = () => {
  const latestUpdateInfos = ref<UpdateInfoObject[]>();

  fetch(
    "https://raw.githubusercontent.com/VOICEVOX/voicevox_blog/master/src/data/updateInfos.json"
  )
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok.");
      return response.json();
    })
    .then((json) => {
      latestUpdateInfos.value = json;
    });

  return latestUpdateInfos;
};
