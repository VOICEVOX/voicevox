import fs from "fs";
import { uuid4 } from "@/helpers/random.ts";
import { createLogger } from "@/helpers/log.ts";

const log = createLogger("fileHelper");

/**
 * 書き込みに失敗したときにファイルが消えないように、
 * tmpファイル書き込み後、保存先ファイルに上書きする
 */
export function writeFileSafely(
  path: string,
  data: string | NodeJS.ArrayBufferView,
) {
  const tmpPath = `${path}-${uuid4()}.tmp`;

  try {
    fs.writeFileSync(tmpPath, data, { flag: "wx" });
    fs.renameSync(tmpPath, path);
  } catch (error) {
    if (fs.existsSync(tmpPath)) {
      void fs.promises.unlink(tmpPath).catch((reason) => {
        log.warn("Failed to remove %s\n  %o", tmpPath, reason);
      });
    }
    throw error;
  }
}
