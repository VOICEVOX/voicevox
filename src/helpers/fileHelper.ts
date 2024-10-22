import fs from "fs";
import { moveFile } from "move-file";
import { ResultError } from "@/type/result";

export async function writeFileSafely(
  path: string,
  data: string | NodeJS.ArrayBufferView,
) {
  // ファイル書き込みに失敗したときに設定が消えないように、tempファイル書き込み後上書き移動する
  const temp_path = `${path}.tmp`;
  await fs.promises.writeFile(temp_path, data);

  await moveFile(temp_path, path, {
    overwrite: true,
  });
}

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
      return "ファイルが見つかりません。";
    }
  }

  return `何らかの理由で失敗しました。${writeFileResult.message}`;
}
