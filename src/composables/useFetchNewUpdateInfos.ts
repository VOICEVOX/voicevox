import { ref } from "vue";
import semver from "semver";
import { z } from "zod";
import { UpdateInfo, UrlString, updateInfoSchema } from "@/type/preload";

/**
 * 現在のバージョンより新しいバージョンがリリースされているか調べる。
 * あれば最新バージョンと、現在より新しいバージョンの情報を返す。
 */
export const useFetchNewUpdateInfos = (
  currentVersionGetter: () => string | Promise<string>,
  newUpdateInfosUrl: UrlString,
) => {
  const result = ref<
    | {
        status: "updateChecking";
      }
    | {
        status: "updateAvailable";
        latestVersion: string;
        newUpdateInfos: UpdateInfo[];
      }
    | {
        status: "updateNotAvailable";
      }
  >({
    status: "updateChecking",
  });

  void (async () => {
    const currentVersion = await currentVersionGetter();

    const updateInfos = await fetch(newUpdateInfosUrl).then(
      async (response) => {
        if (!response.ok) throw new Error("Network response was not ok.");
        return z.array(updateInfoSchema).parse(await response.json());
      },
    );
    const newUpdateInfos = updateInfos.filter((item: UpdateInfo) => {
      return semver.lt(currentVersion, item.version);
    });

    if (newUpdateInfos.length > 0) {
      result.value = {
        status: "updateAvailable",
        latestVersion: newUpdateInfos[0].version,
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
