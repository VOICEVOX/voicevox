import { Ref } from "vue";
import { UpdateInfo } from "@/type/preload";
import { useFetchNewUpdateInfos } from "@/composables/useFetchNewUpdateInfos";

// 最新バージョンの情報をfetchするモックを作成する
const setupFetchMock = (latestVersion: string) => {
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
const waitFinished = async (result: Ref<{ status: string }>) => {
  await vi.waitFor(() => {
    if (result.value.status === "updateChecking") throw new Error();
  });
};

it("新バージョンがある場合、latestVersionに最新バージョンが代入される", async () => {
  const currentVersion = "1.0.0";
  const latestVersion = "2.0.0";
  const skipUpdateVersion = "";
  setupFetchMock(latestVersion);

  const result = useFetchNewUpdateInfos(
    async () => currentVersion,
    async () => skipUpdateVersion,
    "Dummy Url"
  );

  await waitFinished(result);
  expect(result.value).toMatchObject({
    status: "updateAvailable",
    requireNotification: true,
    latestVersion,
  });
});

it("新バージョンがない場合は状態が変わるだけ", async () => {
  const currentVersion = "1.0.0";
  const latestVersion = "1.0.0";
  const skipUpdateVersion = "";
  setupFetchMock(latestVersion);

  const result = useFetchNewUpdateInfos(
    async () => currentVersion,
    async () => skipUpdateVersion,
    "Dummy Url"
  );

  await waitFinished(result);
  expect(result.value).toMatchObject({ status: "updateNotAvailable" });
});

it("skipUpdateVersionがlatestVersion以上の場合requireNotificationがfalseに", async () => {
  const currentVersion = "1.0.0";
  const latestVersion = "2.0.0";
  setupFetchMock(latestVersion);

  const resultEq = useFetchNewUpdateInfos(
    async () => currentVersion,
    async () => "2.0.0",
    "Dummy Url"
  );

  await waitFinished(resultEq);
  expect(resultEq.value).toMatchObject({ requireNotification: false });

  const resultGt = useFetchNewUpdateInfos(
    async () => currentVersion,
    async () => "2.0.1",
    "Dummy Url"
  );

  await waitFinished(resultGt);
  expect(resultGt.value).toMatchObject({ requireNotification: false });
});

it("skipUpdateVersionがlatestVersion未満の場合requireNotificationがtrueに", async () => {
  const currentVersion = "1.0.0";
  const latestVersion = "2.0.0";
  const skipUpdateVersion = "1.0.0";
  setupFetchMock(latestVersion);

  const result = useFetchNewUpdateInfos(
    async () => currentVersion,
    async () => skipUpdateVersion,
    "Dummy Url"
  );

  await waitFinished(result);
  expect(result.value).toMatchObject({ requireNotification: true });
});
