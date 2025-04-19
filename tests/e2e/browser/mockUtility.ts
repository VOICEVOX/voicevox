/**
 * Playwright E2Eテストでブラウザ側の関数をモックするユーティリティ。
 *
 * `page.evaluate()` を介してブラウザ側の `window.backend` の関数をモック化する。
 * 結果はブラウザ側の `window` オブジェクトのプロパティに一時的に追加し、`page.evaluate()` を介して取得する。
 *
 * TODO: モックを戻せるようにする？
 */

import { Page } from "@playwright/test";
import { Brand } from "@/type/utility";
import { success } from "@/type/result";
import { objectEntries, objectFromEntries } from "@/helpers/typedEntries";

type TestFileId = Brand<string, "TestFileId">;

/** ファイル書き出し選択ダイアログをモックにする */
export async function mockShowSaveFileDialog(page: Page): Promise<{
  getFileIds: () => Promise<TestFileId[]>;
}> {
  type _Window = Window & {
    _mockShownSaveFileDialogFileIds: TestFileId[];
  };

  // モックを差し込む
  await page.evaluate(() => {
    const _window = window as unknown as _Window;
    _window._mockShownSaveFileDialogFileIds = [];

    _window.backend.showSaveFileDialog = async () => {
      const id = `${Date.now()}` as TestFileId;
      _window._mockShownSaveFileDialogFileIds.push(id);
      return id;
    };
  });

  return {
    getFileIds: async () => {
      return page.evaluate(() => {
        const _window = window as unknown as _Window;
        return _window._mockShownSaveFileDialogFileIds;
      });
    },
  };
}

/** ファイル書き出しをモックにする */
export async function mockWriteFile(page: Page): Promise<{
  getWrittenFileBuffers: () => Promise<Record<TestFileId, Buffer>>;
}> {
  type _Window = Window & {
    _mockWrittenFileBuffers: Record<TestFileId, Uint8Array>;
  };

  // モックを差し込む
  await page.evaluate(
    ({ successResult }) => {
      const _window = window as unknown as _Window;
      _window._mockWrittenFileBuffers = {};

      _window.backend.writeFile = async ({ filePath, buffer }) => {
        _window._mockWrittenFileBuffers[filePath as TestFileId] =
          new Uint8Array(buffer);
        return successResult;
      };
    },
    // NOTE: page.evaluate内ではimportしたものは使えないので、ここで生成して渡す
    { successResult: success(undefined) },
  );

  return {
    getWrittenFileBuffers: async () => {
      const arrays = await page.evaluate(() => {
        const _window = window as unknown as _Window;
        // NOTE: evaluate() 内で `objectFromEntries` 等は使えない
        return Object.fromEntries(
          Object.entries(_window._mockWrittenFileBuffers).map(
            ([key, value]) => [key, Array.from(value)],
          ),
        );
      });
      return objectFromEntries(
        objectEntries(arrays).map(([key, value]) => [key, Buffer.from(value)]),
      );
    },
  };
}
