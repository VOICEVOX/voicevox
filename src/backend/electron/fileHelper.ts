import fs from "fs";
import log from "electron-log/main";
import { moveFileSync } from "move-file";

/**
 * 書き込みに失敗したときにファイルが消えないように、
 * tmpファイル書き込み後、保存先ファイルに上書きする
 */
export function writeFileSafely(
  path: string,
  data: string | NodeJS.ArrayBufferView,
) {
  let tmpPath: string;
  let maxRetries = 16;
  while (true) {
    maxRetries--;
    try {
      // ランダムな文字列を8文字生成
      const randStr = Math.floor(Math.random() * 36 ** 8)
        .toString(36)
        .padStart(8, "0");
      tmpPath = `${path}-${randStr}.tmp`;
      fs.writeFileSync(tmpPath, data, { flag: "wx" });
      break;
    } catch (error) {
      const e = error as NodeJS.ErrnoException;
      if (e.code !== "EEXIST" || maxRetries <= 0) {
        throw e;
      }
    }
  }

  try {
    moveFileSync(tmpPath, path, {
      overwrite: true,
    });
  } catch (error) {
    fs.promises.unlink(tmpPath).catch((reason) => {
      log.warn("Fail to remove %s\n  %o", tmpPath, reason);
    });
    throw error;
  }
}
