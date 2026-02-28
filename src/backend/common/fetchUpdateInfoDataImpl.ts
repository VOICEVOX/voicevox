import { failure, success } from "@/type/result";

if (!import.meta.env.VITE_LATEST_UPDATE_INFOS_URL) {
  throw new Error(
    "環境変数VITE_LATEST_UPDATE_INFOS_URLが設定されていません。.envに記載してください。",
  );
}

export async function fetchUpdateInfoDataImpl() {
  try {
    return await fetch(import.meta.env.VITE_LATEST_UPDATE_INFOS_URL).then(
      async (resp) => {
        if (!resp.ok) {
          throw new Error(
            `Network response was not ok. status: ${resp.status}`,
          );
        }
        return success(await resp.json());
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      return failure(error);
    }
    return failure(new Error("failed to fetch update info data"));
  }
}
