import { ResultError } from "@/type/result";

export const generateWriteErrorMessage = (writeFileResult: ResultError) => {
  if (writeFileResult.code) {
    const code = writeFileResult.code.toUpperCase();

    if (code.startsWith("ENOSPC")) {
      return "空き容量が足りません。";
    }

    if (code.startsWith("EACCES")) {
      return "ファイルにアクセスする許可がありません。";
    }

    if (code.startsWith("EBUSY")) {
      return "ファイルが開かれています。";
    }
  }

  return `何らかの理由で失敗しました。${writeFileResult.message}`;
};
