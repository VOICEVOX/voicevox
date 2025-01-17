import fs from "fs";
import { moveFileSync } from "move-file";
import { uuid4 } from "@/helpers/random";
import { createLogger } from "@/helpers/log";

const logger = createLogger("fileHelper");

/**
 * 書き込みに失敗したときにファイルが消えないように、
 * tmpファイル書き込み後、保存先ファイルに上書きする
 */
export function writeFileSafely(
  path: string,
  data: string | NodeJS.ArrayBufferView,
) {
  const tmpPath = `${path}-${uuid4()}.tmp`;
  fs.writeFileSync(tmpPath, data, { flag: "wx" });

  try {
    moveFileSync(tmpPath, path, {
      overwrite: true,
    });
  } catch (error) {
    if (fs.existsSync(tmpPath)) {
      fs.promises.unlink(tmpPath).catch((reason) => {
        logger.warn("Failed to remove %s\n  %o", tmpPath, reason);
      });
    }
    throw error;
  }
}
