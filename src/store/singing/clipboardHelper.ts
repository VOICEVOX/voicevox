import { ActionContext, Note } from "../type";
import { noteSchema } from "@/domain/project/schema";

// VOICEVOXソングのノート専用のMIMEタイプ
// VOICEVOX内でノートデータを共有するために使用
const VOICEVOX_NOTES_MIME_TYPE = "web application/vnd.voicevox.song-notes";

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
  if (!selectedTrack) return;

  // ノートが選択されていない場合は何もしない
  if (noteIds.size === 0) return;

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
    // 1. カスタムMIMEタイプを利用してコピー(ElectronをふくむChrome用)
    // Chromeの場合は以下のカスタムMIMEタイプでのコピーを行います。
    // "web application/vnd.voicevox.song-notes"
    //
    // 参考: https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api?hl=ja
    const notesBlob = new Blob([serializedNotes], {
      type: VOICEVOX_NOTES_MIME_TYPE,
    });
    const clipboardItem = new ClipboardItem({
      [VOICEVOX_NOTES_MIME_TYPE]: notesBlob,
    });
    await navigator.clipboard.write([clipboardItem]);
  } catch {
    // 2. カスタムMIMEタイプが利用できない(Chrome以外のブラウザ環境)の場合のフォールバック
    // ノートデータをdata属性に埋め込んだ text/html でコピーします。
    // - VOICEVOXシーケンサーだと、ペースト時に data-* 属性からノートを復元できます。
    // - 他のアプリでは通常、<i> タグや data-* 属性は無視され、何もペーストされません。
    //
    // さらに安全策としての text/plain を追加しています。
    // コピー＆ペーストはブラウザやアプリの実装依存となり、
    // text/html しかない場合にHTMLタグ自体がペーストされる可能性があります。
    // これを防ぐ目的でより優先されやすい text/plain に空文字を設定し、
    // 実質的に何もペーストされない動作を期待します。
    try {
      // <i>のdata属性にノートオブジェクトを埋め込む
      const encodedHtmlNotes = `<i data-voicevox-song-notes="${encodeURIComponent(serializedNotes)}" />`;
      // ノートデータを持つtext/html
      const textHtmlBlob = new Blob([encodedHtmlNotes], {
        type: "text/html",
      });
      // 安全策としてのtext/plainの空文字
      const emptyTextBlob = new Blob([""], {
        type: "text/plain",
      });
      const clipboardItem = new ClipboardItem({
        "text/html": textHtmlBlob,
        "text/plain": emptyTextBlob,
      });
      await navigator.clipboard.write([clipboardItem]);
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

    for (const item of clipboardItems) {
      // 1. カスタムMIMEタイプがあればそれを優先してパース
      if (item.types.includes(VOICEVOX_NOTES_MIME_TYPE)) {
        const blob = await item.getType(VOICEVOX_NOTES_MIME_TYPE);
        const notesText = await blob.text();
        return validateNotesForClipboard(notesText);
      }
      // 2. なければフォールバックとしてtext/htmlをチェックしてパース
      if (item.types.includes("text/html")) {
        const blob = await item.getType("text/html");
        const htmlText = await blob.text();
        const domParser = new DOMParser();
        const doc = domParser.parseFromString(htmlText, "text/html");
        // data-voicevox-song-notesデータ属性を持つ要素を取得
        const elementCandidate = doc.querySelector(
          "[data-voicevox-song-notes]",
        );
        // 要素が取得できないなら次のClipboardItemへ
        if (!elementCandidate) continue;
        // data-voicevox-song-notesデータ属性値を取得
        const encodedData = elementCandidate.getAttribute(
          "data-voicevox-song-notes",
        );
        // 属性値がないなら次のClipboardItemへ
        if (!encodedData) continue;
        const decodedData = decodeURIComponent(encodedData);
        return validateNotesForClipboard(decodedData);
      }
      // 他のタイプはノートペーストにおいては無視
    }

    // なにも見つからなければ空配列とし何もペーストされない
    return [];
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
