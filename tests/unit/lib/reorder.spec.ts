import { expect, test } from "vitest";
import { dragAndDropReorder } from "@/helpers/reorderHelper";

test("1要素の順序を右方向に変更できる", () => {
  expect(
    dragAndDropReorder(["a", "b", "c", "d"], new Set(["b"]), 1, 2),
  ).toEqual(["a", "c", "b", "d"]);
});

test("1要素の順序を左方向に変更できる", () => {
  expect(
    dragAndDropReorder(["a", "b", "c", "d"], new Set(["b"]), 1, 0),
  ).toEqual(["b", "a", "c", "d"]);
});

test("複数要素の順序を右方向に変更できる", () => {
  expect(
    dragAndDropReorder(
      ["a", "b", "c", "d", "e", "f"],
      new Set(["b", "d"]),
      1,
      4,
    ),
  ).toEqual(["a", "c", "e", "b", "d", "f"]);
});

test("複数要素の順序を左方向に変更できる", () => {
  expect(
    dragAndDropReorder(
      ["a", "b", "c", "d", "e", "f"],
      new Set(["b", "d"]),
      1,
      0,
    ),
  ).toEqual(["b", "d", "a", "c", "e", "f"]);
});
