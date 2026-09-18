/**
 * サイズを人間に読みやすい形式に変換する。
 *
 * NOTE:
 * 厳密にはKiB, MiB, GiB, TiBが正しいが、一般的にKB, MB, GB, TBが広く使われているためこちらを採用する。
 */
export function sizeToHumanReadable(sizeInBytes: number): string {
  if (sizeInBytes < 0) {
    throw new Error("Size cannot be negative");
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = sizeInBytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
