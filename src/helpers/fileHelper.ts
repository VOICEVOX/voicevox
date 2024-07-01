import { ResultError } from "@/type/result";

/** ファイル書き込み時のエラーメッセージを生成する */
export function generateWriteErrorMessage(writeFileResult: ResultError) {
  const code = writeFileResult.code?.toUpperCase();

  if (code?.startsWith("ENOSPC")) {
    return "空き容量が足りません。";
  }

  if (code?.startsWith("EACCES")) {
    return "ファイルにアクセスする許可がありません。";
  }

  if (code?.startsWith("EBUSY")) {
    return "ファイルが開かれています。";
  }

  if (code?.startsWith("ENOENT")) {
    return "ファイルが見つかりません。";
  }

  return `何らかの理由で失敗しました。${writeFileResult.message}`;
}
