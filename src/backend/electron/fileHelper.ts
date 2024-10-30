import fs from "fs";
import { moveFileSync } from "move-file";

/**
 * 書き込みに失敗したときにファイルが消えないように、
 * tmpファイル書き込み後、保存先ファイルに上書きする
 */
export function writeFileSafely(
  path: string,
  data: string | NodeJS.ArrayBufferView,
) {
  const tmpPath = `${path}.tmp`;
  fs.writeFileSync(tmpPath, data);

  moveFileSync(tmpPath, path, {
    overwrite: true,
  });
}
