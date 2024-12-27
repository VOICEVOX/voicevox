/**
 * 指定されたファイルパスに対応するファイルが既に存在する場合、
 * ファイル名に連番のサフィックスを追加してユニークなファイルパスを生成する。
 * TODO: src/store/audio.tsのchangeFileTailToNonExistent関数と統合する
 */
export async function generateUniqueFilePath(
  filePathWithoutExtension: string,
  extension: string,
) {
  let filePath = `${filePathWithoutExtension}.${extension}`;
  let tail = 1;
  while (await window.backend.checkFileExists(filePath)) {
    filePath = `${filePathWithoutExtension}[${tail}].${extension}`;
    tail += 1;
  }
  return filePath;
}
