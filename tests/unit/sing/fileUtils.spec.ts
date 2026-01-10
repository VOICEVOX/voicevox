import { vi, describe, it, expect } from "vitest";
import { generateUniqueFilePath } from "@/sing/fileUtils";

// window.backend.checkFileExistsをモックする
// FIXME: テスト実行環境でwindow.backendが未定義なため、vi.stubGlobalが使用できない
// @ts-expect-error: テスト用に window をモックする
global.window = {
  backend: {
    checkFileExists: vi.fn(),
  },
} as unknown as Window & {
  backend: {
    checkFileExists: (path: string) => Promise<boolean>;
  };
};

describe("generateUniqueFilePath", () => {
  it("ファイルが存在しない場合、元のファイルパスを返す", async () => {
    // checkFileExistsが常にfalseを返すようにモック
    (
      window.backend.checkFileExists as ReturnType<typeof vi.fn>
    ).mockResolvedValue(false);

    const filePath = await generateUniqueFilePath("test", "wav");
    expect(filePath).toBe("test.wav");
  });

  it("ファイルが存在する場合、連番のサフィックスが付与されたファイルパスを返す", async () => {
    // 最初の2回はtrue、3回目はfalseを返すようにモック
    (window.backend.checkFileExists as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);

    const filePath = await generateUniqueFilePath("test", "wav");
    expect(filePath).toBe("test[2].wav");
  });
});
