import fs from "fs";
import { moveFile } from "move-file";

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
