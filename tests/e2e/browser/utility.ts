import { Page } from "@playwright/test";
import { Brand } from "@/type/utility";
import { success } from "@/type/result";

type TestFileId = Brand<string, "TestFileId">;

/** ファイル書き出し選択ダイアログをモックにする */
// TODO: モックを戻せるようにする
export async function mockShowSaveFileDialog(page: Page): Promise<{
  getFileIds: () => Promise<TestFileId[]>;
}> {
  type _Window = Window & {
    _mockShowSaveFileDialog: {
      returnValues: TestFileId[];
    };
  };

  // モックを差し込む
  await page.evaluate(() => {
    const _window = window as unknown as _Window;
    _window._mockShowSaveFileDialog = {
      returnValues: [],
    };

    _window.backend.showSaveFileDialog = async () => {
      const id = `${Date.now()}` as TestFileId;
      _window._mockShowSaveFileDialog.returnValues.push(id);
      return id;
    };
  });

  return {
    getFileIds: async () => {
      return page.evaluate(() => {
        const _window = window as unknown as _Window;
        return _window._mockShowSaveFileDialog.returnValues;
      });
    },
  };
}

/** ファイル書き出しをモックにする */
// TODO: モックを戻せるようにする
export async function mockWriteFile(page: Page): Promise<{
  getWrittenFileBuffers: () => Promise<Record<string | TestFileId, Buffer>>;
}> {
  type _Window = Window & {
    _mockWriteFile: Record<string | TestFileId, Uint8Array>;
  };

  // モックを差し込む
  await page.evaluate(
    ({ sucecssResult }) => {
      const _window = window as unknown as _Window;
      _window._mockWriteFile = {};

      _window.backend.writeFile = async ({ filePath, buffer }) => {
        _window._mockWriteFile[filePath] = new Uint8Array(buffer);
        return sucecssResult;
      };
    },
    { sucecssResult: success(undefined) },
  );

  return {
    getWrittenFileBuffers: async () => {
      const arrays = await page.evaluate(() => {
        const _window = window as unknown as _Window;
        return Object.fromEntries(
          Object.entries(_window._mockWriteFile).map(([key, value]) => [
            key,
            Array.from(value),
          ]),
        );
      });
      return Object.fromEntries(
        Object.entries(arrays).map(([key, value]) => [key, Buffer.from(value)]),
      );
    },
  };
}
