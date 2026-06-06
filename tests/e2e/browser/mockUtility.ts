/**
 * Playwright E2Eテストでブラウザ側の関数をモックするユーティリティ。
 *
 * `page.evaluate()` を介してブラウザ側の `window.backend` の関数をモック化する。
 * 結果はブラウザ側の `window` オブジェクトのプロパティに一時的に追加し、`page.evaluate()` を介して取得する。
 *
 * TODO: モックを戻せるようにする？
 */

import type { Page } from "@playwright/test";
import type { Brand } from "@/type/utility";
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

/** 次のファイル選択ダイアログをモックし、指定したファイルを選択したことにする */
export async function mockShowOpenFileDialog(
  page: Page,
  filePath: string,
): Promise<void> {
  type _Window = Window;
  await page.evaluate(
    ({ filePath }) => {
      const _window = window as unknown as _Window;
      const originalShowOpenFileDialog =
        _window.backend.showOpenFileDialog.bind(window.backend);
      _window.backend.showOpenFileDialog = async () => {
        _window.backend.showOpenFileDialog = originalShowOpenFileDialog;
        return filePath;
      };
    },
    { filePath },
  );
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

/** 特定のファイルの読み込みをモックにする */
export async function mockReadFile(
  page: Page,
  filePath: string,
  buffer: Buffer,
): Promise<void> {
  type _Window = Window;

  await page.evaluate(
    ({ mockedFilePath, successResult }) => {
      const _window = window as unknown as _Window;
      const originalReadFile = _window.backend.readFile.bind(_window.backend);
      _window.backend.readFile = async ({ filePath: readingFilePath }) => {
        if (readingFilePath === mockedFilePath) {
          return successResult;
        } else {
          return originalReadFile({ filePath: readingFilePath });
        }
      };
    },
    {
      mockedFilePath: filePath,
      successResult: success(new Uint8Array(buffer)),
    },
  );
}

/**
 * ディレクトリ選択ダイアログをモックにする
 * TODO: 選択されたディレクトリIDを返すようにする
 */
export async function mockShowSaveDirectoryDialog(page: Page): Promise<void> {
  type _Window = Window;

  await page.evaluate(() => {
    const _window = window as unknown as _Window;
    _window.backend.showSaveDirectoryDialog = async () => {
      return `${Date.now()}`;
    };
  });
}

/** writeFileを常に失敗Resultを返すモックにする */
export async function mockWriteFileError(page: Page): Promise<void> {
  type _Window = Window;

  const code = "EACCES";
  const message = "mock write error";

  await page.evaluate(
    ({ code, message }) => {
      const _window = window as unknown as _Window;
      _window.backend.writeFile = async () => {
        return { ok: false, code, error: new Error(message) };
      };
    },
    { code, message },
  );
}
