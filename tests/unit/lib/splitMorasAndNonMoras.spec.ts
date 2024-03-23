import { expect, it } from "vitest";
import { splitMorasAndNonMoras } from "@/sing/domain";

it("モーラを分割する", () => {
  expect(splitMorasAndNonMoras("アイウエオ")).toEqual([
    "ア",
    "イ",
    "ウ",
    "エ",
    "オ",
  ]);
  expect(splitMorasAndNonMoras("キャット")).toEqual(["キャ", "ッ", "ト"]);
});
it("平仮名対応", () => {
  expect(splitMorasAndNonMoras("あいうえお")).toEqual([
    "ア",
    "イ",
    "ウ",
    "エ",
    "オ",
  ]);
});
it("長音対応", () => {
  expect(splitMorasAndNonMoras("アーイー")).toEqual(["ア", "ア", "イ", "イ"]);
});

it("モーラ以外が混ざっても残す", () => {
  expect(splitMorasAndNonMoras("アaイ")).toEqual(["ア", "a", "イ"]);
});
it("最大の要素数を指定できる", () => {
  expect(splitMorasAndNonMoras("アイウエオ", 3)).toEqual([
    "ア",
    "イ",
    "ウエオ",
  ]);
});
