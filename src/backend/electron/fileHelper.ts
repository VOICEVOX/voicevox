import fs from "fs";
import { moveFileSync } from "move-file";

export function writeFileSafely(
  path: string,
  data: string | NodeJS.ArrayBufferView,
) {
  // ファイル書き込みに失敗したときに設定が消えないように、tempファイル書き込み後上書き移動する
  const temp_path = `${path}.tmp`;
  fs.writeFileSync(temp_path, data);

  moveFileSync(temp_path, path, {
    overwrite: true,
  });
}
