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
    "ア",
    "イ",
    "ウ",
    "エ",
    "オ",
  ]);
});
it("長音対応", () => {
  expect(splitLyricsByMoras("アーイー")).toEqual(["ア", "ア", "イ", "イ"]);
});

it("モーラ以外が混ざっても残す", () => {
  expect(splitLyricsByMoras("アaイ")).toEqual(["ア", "a", "イ"]);
});
it("最大の要素数を指定できる", () => {
  expect(splitLyricsByMoras("アイウエオ", 3)).toEqual(["ア", "イ", "ウエオ"]);
});
