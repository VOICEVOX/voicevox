import { ResultError } from "@/type/result";

/** ファイル書き込み時のエラーメッセージを生成する */
// instanceof ResultErrorで生まれるResultError<any>を受け取れるようにするため、anyを許容する
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateWriteErrorMessage(writeFileResult: ResultError<any>) {
  if (typeof writeFileResult.code === "string") {
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
      return "指定されたファイルまたはフォルダが見つかりません。";
    }
  }

  return `何らかの理由で失敗しました。${writeFileResult.message}`;
}
