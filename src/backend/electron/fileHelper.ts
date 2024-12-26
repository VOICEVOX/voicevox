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
  try {
    // 上書きでないのなら直接書き込む
    fs.writeFileSync(path, data, { flag: "wx" });
    return;
  } catch (error) {
    const e = error as NodeJS.ErrnoException;
    if (e.code !== "EEXIST") {
      throw e;
    }
    const stat = fs.statSync(path, { throwIfNoEntry: false });
    if (stat != undefined && !stat.isFile()) {
      // 書き込み先に既にフォルダ等があり上書きできない場合
      throw e;
    }
  }
  const tmpPath = `${path}.tmp`;
  fs.writeFileSync(tmpPath, data);

  moveFileSync(tmpPath, path, {
    overwrite: true,
  });
}
