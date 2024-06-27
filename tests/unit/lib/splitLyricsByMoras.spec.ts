import { expect, it } from "vitest";
import { splitLyricsByMoras } from "@/sing/domain";

it("モーラを分割する", () => {
  expect(splitLyricsByMoras("アイウエオ")).toEqual([
    "ア",
    "イ",
    "ウ",
    "エ",
    "オ",
  ]);
  expect(splitLyricsByMoras("キャット")).toEqual(["キャ", "ッ", "ト"]);
});
it("平仮名対応", () => {
  expect(splitLyricsByMoras("あいうえお")).toEqual([
    "あ",
    "い",
    "う",
    "え",
    "お",
  ]);
});
it("長音対応", () => {
  expect(splitLyricsByMoras("アーイーー")).toEqual([
    "ア",
    "ア",
    "イ",
    "イ",
    "イ",
  ]);
  expect(splitLyricsByMoras("あーいーー")).toEqual([
    "あ",
    "あ",
    "い",
    "い",
    "い",
  ]);
});

it("モーラ以外が混ざっても残す", () => {
  expect(splitLyricsByMoras("アaイ")).toEqual(["ア", "a", "イ"]);
  expect(splitLyricsByMoras("bウc")).toEqual(["b", "ウ", "c"]);
  expect(splitLyricsByMoras("愛")).toEqual(["愛"]);
  // 先頭の長音はモーラとして扱わない
  expect(splitLyricsByMoras("ー")).toEqual(["ー"]);
});
it("最大の要素数を指定できる", () => {
  expect(splitLyricsByMoras("アイウエオ", 3)).toEqual(["ア", "イ", "ウエオ"]);
});
