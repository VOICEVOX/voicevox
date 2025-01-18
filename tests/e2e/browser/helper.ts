import { Page } from "@playwright/test";
import { Brand } from "@/type/utility";
import { success } from "@/type/result";

type TestFileId = Brand<string, "TestFileId">;

type TestStorageWindow = Window & {
  _testStorage: Record<TestFileId, Uint8Array>;
};

/** ファイル書き出しのスパイを設定する */
// TODO: showExportFileDialogを呼ばない場合のことを考える
// TODO: 元に戻せるようにしておく
export async function spyWriteFile(
  page: Page,
  payload: { num: number },
): Promise<{ buffer: (index: number) => Promise<Buffer> }> {
  const id = `${Date.now()}`;
  const ids = Array.from(
    { length: payload.num },
    (_, i) => `${id}-${i}` as TestFileId,
  );

  await page.evaluate(
    ({ sucecssResult, ids }) => {
      const testStorageWindow = window as unknown as TestStorageWindow;
      testStorageWindow._testStorage = testStorageWindow._testStorage || {};

      let count = 0;
      testStorageWindow.backend.showExportFileDialog = async ({ title }) => {
        if (count >= ids.length)
          throw new Error(
            `Unexpected call: ${title}. Call count: ${count}, expected: ${ids.length}`,
          );
        return ids[count++];
      };
      testStorageWindow.backend.writeFile = async ({ filePath, buffer }) => {
        const array = new Uint8Array(buffer);
        testStorageWindow._testStorage[filePath as TestFileId] = array;
        return sucecssResult;
      };
    },
    { sucecssResult: success(undefined), ids },
  );

  const buffer = async (index: number) => {
    const array = await page.evaluate((id) => {
      const testStorageWindow = window as unknown as TestStorageWindow;
      return Array.from(testStorageWindow._testStorage[id]);
    }, ids[index]);
    return Buffer.from(array);
  };

  return { buffer };
}
