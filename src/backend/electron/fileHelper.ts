import fs from "node:fs";
import path from "node:path";
import { uuid4 } from "@/helpers/random";
import { createLogger } from "@/helpers/log";

const log = createLogger("fileHelper");

/**
 * 指定されたパスが指定されたディレクトリの中に含まれるかどうかを判定する
 * 判定するパスが同じディレクトリを指している場合はfalseを返す
 * シンボリックリンクは辿らない
 * @param directory ディレクトリのパス
 * @param filepath 判定するパス
 * @returns filepathがdirectoryの中に含まれる場合はtrue、含まれない場合はfalse
 */
export function isPathWithinDirectory(
  directory: string,
  filepath: string,
): boolean {
  const relativePath = path.relative(directory, filepath);
  return !(
    path.isAbsolute(relativePath) ||
    relativePath.startsWith(`..${path.sep}`) ||
    relativePath === ".." ||
    relativePath === ""
  );
}

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
