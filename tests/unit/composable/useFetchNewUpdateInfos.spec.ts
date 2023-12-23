import { Ref } from "vue";
import { UpdateInfo } from "@/type/preload";
import { useFetchNewUpdateInfos } from "@/composables/useFetchNewUpdateInfos";

// 現バージョンや新バージョンの情報を返すモックを作成する
const setupMock = ({
  currentVersion,
  latestVersion,
}: {
  currentVersion: string;
  latestVersion: string;
}) => {
  // window.electron.getAppInfosのモックを作成
  vi.stubGlobal("window", {
    electron: {
      getAppInfos: async () => {
        return { version: currentVersion };
      },
    },
  });

  // fetchのモックを作成
  const updateInfos: UpdateInfo[] = [
    {
      version: latestVersion,
      descriptions: [],
      contributors: [],
    },
  ];
  vi.stubGlobal("fetch", async () => {
    return new Response(JSON.stringify(updateInfos), { status: 200 });
  });
};

// 準備完了まで待機
const waitFinished = async (isCheckingFinished: Ref<boolean>) => {
  await vi.waitFor(() => {
    if (!isCheckingFinished.value) throw new Error();
  });
};

it("新バージョンがある場合、latestVersionに最新バージョンが代入される", async () => {
  setupMock({ currentVersion: "1.0.0", latestVersion: "2.0.0" });

  const { isCheckingFinished, latestVersion, newUpdateInfos } =
    useFetchNewUpdateInfos("http://example.com");

  await waitFinished(isCheckingFinished);
  expect(latestVersion.value).toBe("2.0.0");
  expect(newUpdateInfos.value).toHaveLength(1);
});

it("新バージョンがない場合、latestVersionは空", async () => {
  setupMock({ currentVersion: "1.0.0", latestVersion: "1.0.0" });

  const { isCheckingFinished, latestVersion, newUpdateInfos } =
    useFetchNewUpdateInfos("http://example.com");

  await waitFinished(isCheckingFinished);
  expect(latestVersion.value).toBe("");
  expect(newUpdateInfos.value).toHaveLength(0);
});
