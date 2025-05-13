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

  // 選択されたノートを抽出
  const selectedNotes = selectedTrack.notes.filter((note) =>
    noteIds.has(note.id),
  );

  // VOICEVOXのノートのペースト用としてノートをJSONにシリアライズ（idを除外）
  const serializedNotes = JSON.stringify(
    selectedNotes.map((note) => {
      const { id, ...noteWithoutId } = note;
      return noteWithoutId;
    }),
  );

  // プレーンテキストとしての歌詞を作成
  const plainTextLyrics = selectedNotes.map((note) => note.lyric).join("");

  await writeNotesToClipboard(serializedNotes, plainTextLyrics);
}

/**
 * クリップボードにデータを書き込む
 * @param serializedNotes シリアライズされたノートデータオブジェクト
 * @param plainTextLyrics プレーンテキストとしての歌詞
 * @throws クリップボードへの書き込みに失敗した場合
 */
async function writeNotesToClipboard(
  serializedNotes: string,
  plainTextLyrics: string,
): Promise<void> {
  // text/plain としての歌詞を用意
  const lyricsTextBlob = new Blob([plainTextLyrics], {
    type: "text/plain",
  });

  try {
    // 1. まずはカスタムMIMEタイプを利用してコピーを試みます(ElectronをふくむChrome用)
    // 以下のカスタムMIMEタイプでのコピーを行います。
    // "web application/vnd.voicevox.song-notes"
    //
    // 参考: https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api?hl=ja
    const notesBlob = new Blob([serializedNotes], {
      type: VOICEVOX_NOTES_MIME_TYPE,
    });
    const clipboardItem = new ClipboardItem({
      [VOICEVOX_NOTES_MIME_TYPE]: notesBlob,
      "text/plain": lyricsTextBlob,
    });
    await navigator.clipboard.write([clipboardItem]);
  } catch {
    try {
      // 2. カスタムMIMEタイプが利用できない(Chrome以外のブラウザ環境等)の場合はフォールバックします
      // ノートデータをdata属性に埋め込んだ text/html でコピーします。
      // - VOICEVOXシーケンサーだと、ペースト時に data-* 属性からノートを復元できます。
      // - 他のアプリでは通常、<i> タグや data-* 属性は無視され、何もペーストされません。
      //
      // コピー＆ペーストはブラウザやアプリの実装依存となり、
      // text/html しかない場合にHTMLタグ自体がペーストされる可能性があります。
      // これを防ぐ目的でより優先されやすい text/plain も設定します。

      // <i>のdata属性にノートオブジェクトを埋め込む
      const encodedHtmlNotes = `<i data-voicevox-song-notes="${encodeURIComponent(
        serializedNotes,
      )}" />`;
      // ノートデータを持つtext/html
      const textHtmlBlob = new Blob([encodedHtmlNotes], {
        type: "text/html",
      });

      const clipboardItem = new ClipboardItem({
        "text/html": textHtmlBlob,
        "text/plain": lyricsTextBlob,
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
