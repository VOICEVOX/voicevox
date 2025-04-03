import { ActionContext, Note } from "../type";
import { noteSchema } from "@/domain/project/schema";

// VOICEVOXソングのノート専用のMIMEType
export const VOICEVOX_NOTES_MIME_TYPE =
  "web application/vnd.voicevox.song-notes";

/**
 * 選択されたノートをクリップボードにコピーする
 * @param context ActionContext
 * @throws クリップボードへの書き込みに失敗した場合
 */
export async function copyNotesToClipboard(
  context: ActionContext,
): Promise<void> {
  const { getters } = context;
  const selectedTrack = getters.SELECTED_TRACK;
  const noteIds = getters.SELECTED_NOTE_IDS;

  // 選択されたトラックがない場合は何もしない
  if (!selectedTrack) {
    return;
  }

  // ノートが選択されていない場合は何もしない
  if (noteIds.size === 0) {
    return;
  }

  // 選択されたノートのみをコピーする
  const selectedNotesForCopy = selectedTrack.notes
    .filter((note: Note) => noteIds.has(note.id))
    .map((note: Note) => {
      // idのみコピーしない
      const { id, ...noteWithoutId } = note;
      return noteWithoutId;
    });

  // VOICEVOXのノートのペースト用としてノートをJSONにシリアライズ
  const serializedNotes = JSON.stringify(selectedNotesForCopy);

  await writeNotesToClipboard(serializedNotes);
}

/**
 * クリップボードにデータを書き込む
 * @param serializedNotes シリアライズされたノートデータオブジェクト
 * @throws クリップボードへの書き込みに失敗した場合
 */
async function writeNotesToClipboard(serializedNotes: string): Promise<void> {
  try {
    // 1. カスタムMIMEタイプを利用してコピー
    // web application/vnd.voicevox.song-notes
    // web からはじまる形式はChromeのみでサポート
    const notesBlob = new Blob([serializedNotes], {
      type: VOICEVOX_NOTES_MIME_TYPE,
    });
    const clipboardItem = new ClipboardItem({
      [VOICEVOX_NOTES_MIME_TYPE]: notesBlob,
    });
    await navigator.clipboard.write([clipboardItem]);
  } catch {
    // 2. カスタムMIMEタイプが利用できない(Chrome以外のブラウザ環境)の場合のフォールバック
    // クリップボードにノートデータオブジェクトをシリアライズした形式で書き込みを試みる
    try {
      await navigator.clipboard.writeText(serializedNotes);
    } catch (clipboardWriteError) {
      // クリップボード書き込みに失敗した場合はエラー
      throw new Error("Failed to copy notes to clipboard.", {
        cause: clipboardWriteError,
      });
    }
  }
}

/**
 * クリップボードからノートオブジェクトを読み取る
 * @returns 読み取ったノート配列(idは除外されている)
 */
export async function readNotesFromClipboard(): Promise<Omit<Note, "id">[]> {
  try {
    const clipboardItems = await navigator.clipboard.read();

    // 1. カスタムMIMEタイプのアイテムを先に探して、あれば返す
    for (const item of clipboardItems) {
      if (item.types.includes(VOICEVOX_NOTES_MIME_TYPE)) {
        const blob = await item.getType(VOICEVOX_NOTES_MIME_TYPE);
        const notesText = await blob.text();
        // 発見したら早期リターン
        return validateNotesForClipboard(notesText);
      }
    }

    // 2. カスタムMIMEタイプが見つからなかったらテキストとして読み取り、JSONとしてパースを試みて返す
    const clipboardPlainText = await navigator.clipboard.readText();
    try {
      return validateNotesForClipboard(clipboardPlainText);
    } catch (validationError) {
      // バリデーション失敗したらエラーをスロー
      throw new Error("Failed to parse notes from clipboard.", {
        cause: validationError,
      });
    }
    // クリップボードが読めないなどであればエラーをスロー
  } catch (clipboardReadError) {
    throw new Error("Failed to read notes from clipboard.", {
      cause: clipboardReadError,
    });
  }
}

/**
 * コピー＆ペースト用のノートデータをバリデーションする
 * @param clipboardText
 * @returns バリデーション済みのノート配列（idは除外）
 * @throws バリデーション失敗時にエラーをスロー
 */
function validateNotesForClipboard(clipboardText: string): Omit<Note, "id">[] {
  try {
    return noteSchema
      .omit({ id: true })
      .array()
      .parse(JSON.parse(clipboardText));
  } catch (validationError) {
    throw new Error("Failed to validate notes for clipboard data.", {
      cause: validationError,
    });
  }
}
