/**
 * 指定されたファイルパスに対応するファイルが既に存在する場合、
 * ファイル名に連番のサフィックスを追加してユニークなファイルパスを生成する。
 */
export async function generateUniqueFilePath(
  filePathWithoutExtension: string,
  extention: string,
) {
  let filePath = `${filePathWithoutExtension}.${extention}`;
  let tail = 1;
  while (await window.backend.checkFileExists(filePath)) {
    filePath = `${filePathWithoutExtension}[${tail}].${extention}`;
    tail += 1;
  }
  return filePath;
}
