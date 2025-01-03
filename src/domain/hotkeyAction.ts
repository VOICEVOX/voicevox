import { z } from "zod";

const hotkeyCombinationSchema = z.string().brand("HotkeyCombination");
export type HotkeyCombination = z.infer<typeof hotkeyCombinationSchema>;
export const HotkeyCombination = (
  hotkeyCombination: string,
): HotkeyCombination => hotkeyCombinationSchema.parse(hotkeyCombination);

// 共通のアクション名
export const actionPostfixSelectNthCharacter = "番目のキャラクターを選択";

export const hotkeyActionNameSchema = z.enum([
  "音声書き出し",
  "選択音声を書き出し",
  "音声を繋げて書き出し",
  "再生/停止",
  "連続再生/停止",
  "ｱｸｾﾝﾄ欄を表示",
  "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
  "長さ欄を表示",
  "テキスト欄を追加",
  "テキスト欄を複製",
  "テキスト欄を削除",
  "テキスト欄からフォーカスを外す",
  "テキスト欄にフォーカスを戻す",
  "元に戻す",
  "やり直す",
  "新規プロジェクト",
  "プロジェクトを名前を付けて保存",
  "プロジェクトを上書き保存",
  "プロジェクトを読み込む",
  "テキストを読み込む",
  "全体のイントネーションをリセット",
  "選択中のアクセント句のイントネーションをリセット",
  "コピー",
  "切り取り",
  "貼り付け",
  "すべて選択",
  "選択解除",
  `1${actionPostfixSelectNthCharacter}`,
  `2${actionPostfixSelectNthCharacter}`,
  `3${actionPostfixSelectNthCharacter}`,
  `4${actionPostfixSelectNthCharacter}`,
  `5${actionPostfixSelectNthCharacter}`,
  `6${actionPostfixSelectNthCharacter}`,
  `7${actionPostfixSelectNthCharacter}`,
  `8${actionPostfixSelectNthCharacter}`,
  `9${actionPostfixSelectNthCharacter}`,
  `10${actionPostfixSelectNthCharacter}`,
  "全画面表示を切り替え",
  "拡大",
  "縮小",
  "拡大率のリセット",
]);
export type HotkeyActionNameType = z.infer<typeof hotkeyActionNameSchema>;

export const hotkeySettingSchema = z.object({
  action: hotkeyActionNameSchema,
  combination: hotkeyCombinationSchema,
});
export type HotkeySettingType = z.infer<typeof hotkeySettingSchema>;

export function getDefaultHotkeySettings({
  isMac,
}: {
  isMac: boolean;
}): HotkeySettingType[] {
  return [
    {
      action: "音声書き出し",
      combination: HotkeyCombination(!isMac ? "Ctrl E" : "Meta E"),
    },
    {
      action: "選択音声を書き出し",
      combination: HotkeyCombination("E"),
    },
    {
      action: "音声を繋げて書き出し",
      combination: HotkeyCombination(""),
    },
    {
      action: "再生/停止",
      combination: HotkeyCombination("Space"),
    },
    {
      action: "連続再生/停止",
      combination: HotkeyCombination("Shift Space"),
    },
    {
      action: "ｱｸｾﾝﾄ欄を表示",
      combination: HotkeyCombination("1"),
    },
    {
      action: "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
      combination: HotkeyCombination("2"),
    },
    {
      action: "長さ欄を表示",
      combination: HotkeyCombination("3"),
    },
    {
      action: "テキスト欄を追加",
      combination: HotkeyCombination("Shift Enter"),
    },
    {
      action: "テキスト欄を複製",
      combination: HotkeyCombination(!isMac ? "Ctrl D" : "Meta D"),
    },
    {
      action: "テキスト欄を削除",
      combination: HotkeyCombination("Shift Delete"),
    },
    {
      action: "テキスト欄からフォーカスを外す",
      combination: HotkeyCombination("Escape"),
    },
    {
      action: "テキスト欄にフォーカスを戻す",
      combination: HotkeyCombination("Enter"),
    },
    {
      action: "元に戻す",
      combination: HotkeyCombination(!isMac ? "Ctrl Z" : "Meta Z"),
    },
    {
      action: "やり直す",
      combination: HotkeyCombination(!isMac ? "Ctrl Y" : "Shift Meta Z"),
    },
    {
      action: "拡大",
      combination: HotkeyCombination(""),
    },
    {
      action: "縮小",
      combination: HotkeyCombination(""),
    },
    {
      action: "拡大率のリセット",
      combination: HotkeyCombination(""),
    },
    {
      action: "新規プロジェクト",
      combination: HotkeyCombination(!isMac ? "Ctrl N" : "Meta N"),
    },
    {
      action: "全画面表示を切り替え",
      combination: HotkeyCombination(!isMac ? "F11" : "Ctrl Meta F"),
    },
    {
      action: "プロジェクトを名前を付けて保存",
      combination: HotkeyCombination(!isMac ? "Ctrl Shift S" : "Shift Meta S"),
    },
    {
      action: "プロジェクトを上書き保存",
      combination: HotkeyCombination(!isMac ? "Ctrl S" : "Meta S"),
    },
    {
      action: "プロジェクトを読み込む",
      combination: HotkeyCombination(!isMac ? "Ctrl O" : "Meta O"),
    },
    {
      action: "テキストを読み込む",
      combination: HotkeyCombination(""),
    },
    {
      action: "全体のイントネーションをリセット",
      combination: HotkeyCombination(!isMac ? "Ctrl G" : "Meta G"),
    },
    {
      action: "選択中のアクセント句のイントネーションをリセット",
      combination: HotkeyCombination("R"),
    },
    {
      action: "コピー",
      combination: HotkeyCombination(!isMac ? "Ctrl C" : "Meta C"),
    },
    {
      action: "切り取り",
      combination: HotkeyCombination(!isMac ? "Ctrl X" : "Meta X"),
    },
    {
      action: "貼り付け",
      combination: HotkeyCombination(!isMac ? "Ctrl V" : "Meta V"),
    },
    {
      action: "すべて選択",
      combination: HotkeyCombination(!isMac ? "Ctrl A" : "Meta A"),
    },
    {
      action: "選択解除",
      combination: HotkeyCombination("Escape"),
    },
    ...Array.from({ length: 10 }, (_, index) => {
      const roleKey = index == 9 ? 0 : index + 1;
      return {
        action:
          `${index + 1}${actionPostfixSelectNthCharacter}` as HotkeyActionNameType,
        combination: HotkeyCombination(
          `${!isMac ? "Ctrl" : "Meta"} ${roleKey}`,
        ),
      };
    }),
  ];
}
