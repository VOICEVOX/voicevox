import { ref } from "vue";
import semver from "semver";
import { z } from "zod";
import { UpdateInfo, updateInfoSchema } from "@/type/preload";

// 最新版があるか調べる
// 現バージョンより新しい最新版があれば`latestVersion`に代入される
export const useFetchNewUpdateInfos = (newUpdateInfosUrl: string) => {
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
      fetch(newUpdateInfosUrl)
        .then(async (response) => {
          if (!response.ok) throw new Error("Network response was not ok.");
          return z.array(updateInfoSchema).parse(await response.json());
        })
        .then((updateInfos) => {
          newUpdateInfos.value = updateInfos.filter((item: UpdateInfo) => {
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
