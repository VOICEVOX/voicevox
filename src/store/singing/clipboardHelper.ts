import { ActionContext, Note } from "../type";
import { noteSchema } from "@/domain/project/schema";

// VOICEVOXソングのノート専用のMIMEType
export const VOICEVOX_NOTES_MIME_TYPE =
  "web application/vnd.voicevox.song-notes";

/**
 * 選択されたノートをクリップボードにコピーする
 */
export async function copyNotesToClipboard(
  context: ActionContext,
): Promise<void> {
  const { getters } = context;
  const selectedTrack = getters.SELECTED_TRACK;
  const noteIds = getters.SELECTED_NOTE_IDS;

  // ノートが選択されていない場合は何もしない
  if (noteIds.size === 0) {
    return;
  }

  // 選択されたノートのみをコピーする
  const selectedNotes = selectedTrack.notes
    .filter((note: Note) => noteIds.has(note.id))
    .map((note: Note) => {
      // idのみコピーしない
      const { id, ...noteWithoutId } = note;
      return noteWithoutId;
    });

  // VOICEVOXのノートのペースト用としてノートをJSONにシリアライズ
  const jsonVoicevoxNotes = JSON.stringify(selectedNotes);
  // 歌詞のみのテキストとしてノートのテキストを結合
  const plainTextLyric = selectedNotes.map((note) => note.lyric).join("");

  await writeNotesToClipboard(jsonVoicevoxNotes, plainTextLyric);
}

/**
 * クリップボードにデータを書き込む
 * @throws クリップボードへの書き込みに失敗した場合
 */
export async function writeNotesToClipboard(
  jsonVoicevoxNotes: string,
  plainTextLyric: string,
): Promise<void> {
  // カスタムMIMEタイプを利用してクリップボードに書き込みを試みる
  try {
    // MIMEタイプとしてapplication/jsonとtext/plainを使用してクリップボードにコピーする
    // web application/vnd.voicevox.song-notes - VOICEVOXでのノート構造を保持してペーストできる
    // text/plain - 歌詞テキストだけを内部または他のエディタなどで利用できるようにする
    // web形式からはじまる形式はChromeのみでサポートされている
    const voicevoxNotesBlob = new Blob([jsonVoicevoxNotes], {
      type: VOICEVOX_NOTES_MIME_TYPE,
    });
    const textBlob = new Blob([plainTextLyric], { type: "text/plain" });
    const clipboardItem = new ClipboardItem({
      [VOICEVOX_NOTES_MIME_TYPE]: voicevoxNotesBlob,
      "text/plain": textBlob,
    });
    await navigator.clipboard.write([clipboardItem]);
  } catch {
    // カスタムMIMEタイプを利用してのコピーが失敗した場合、クリップボードに通常のテキスト形式で書き込みを試みる
    try {
      await navigator.clipboard.writeText(jsonVoicevoxNotes);
    } catch (e) {
      // クリップボード書き込みに失敗した場合はエラー
      throw new Error("Failed to copy notes to clipboard.", {
        cause: e,
      });
    }
  }
}

/**
 * クリップボードからVOICEVOXノートを読み取る
 * @returns 読み取ったノート配列(idは除外されている)
 */
export async function readNotesFromClipboard(): Promise<Omit<Note, "id">[]> {
  try {
    const clipboardItems = await navigator.clipboard.read();

    // カスタムMIMEタイプのアイテムを探す
    for (const item of clipboardItems) {
      if (item.types.includes(VOICEVOX_NOTES_MIME_TYPE)) {
        const blob = await item.getType(VOICEVOX_NOTES_MIME_TYPE);
        const voicevoxNotesText = await blob.text();
        // noteSchemaでバリデーション
        return noteSchema
          .omit({ id: true })
          .array()
          .parse(JSON.parse(voicevoxNotesText));
      }
    }

    // カスタムMIMEタイプが見つからなかったらテキストとして読み取り、JSONとしてパースを試みる
    const clipboardText = await navigator.clipboard.readText();
    try {
      // noteSchemaでバリデーション
      return noteSchema
        .omit({ id: true })
        .array()
        .parse(JSON.parse(clipboardText));
    } catch (e) {
      throw new Error("Failed to parse notes from clipboard.", { cause: e });
    }
  } catch (e) {
    throw new Error("Failed to read notes from clipboard.", {
      cause: e,
    });
  }
}
