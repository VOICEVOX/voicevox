import { ref } from "vue";
import semver from "semver";
import { z } from "zod";
import { UpdateInfo, updateInfoSchema } from "@/type/preload";

/**
 * 現在のバージョンより新しいバージョンがリリースされているか調べる。
 * あれば最新バージョンと、現在より新しいバージョンの情報を返す。
 */
export const useFetchNewUpdateInfos = (
  currentVersionGetter: () => Promise<string>,
  skipUpdateVersionGetter: () => Promise<string>,
  newUpdateInfosUrl: string
) => {
  const result = ref<
    | {
        status: "updateChecking";
      }
    | {
        status: "updateAvailable";
        requireNotification: boolean;
        latestVersion: string;
        newUpdateInfos: UpdateInfo[];
      }
    | {
        status: "updateNotAvailable";
      }
  >({
    status: "updateChecking",
  });

  (async () => {
    const currentVersion = await currentVersionGetter();
    const skipUpdateVersion = await skipUpdateVersionGetter();

    const updateInfos = await fetch(newUpdateInfosUrl).then(
      async (response) => {
        if (!response.ok) throw new Error("Network response was not ok.");
        return z.array(updateInfoSchema).parse(await response.json());
      }
    );
    const newUpdateInfos = updateInfos.filter((item: UpdateInfo) => {
      return semver.lt(currentVersion, item.version);
    });

    if (newUpdateInfos.length > 0) {
      const latestVersion = newUpdateInfos[0].version;
      const requireNotification =
        semver.valid(skipUpdateVersion) == undefined ||
        semver.gt(latestVersion, skipUpdateVersion);

      result.value = {
        status: "updateAvailable",
        requireNotification,
        latestVersion,
        newUpdateInfos,
      };
    } else {
      result.value = {
        status: "updateNotAvailable",
      };
    }
  })();

  return result;
};
