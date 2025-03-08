import {
  createKanaRegex,
  convertHiraToKana,
  convertLongVowel,
} from "@/domain/japanese";

describe("createKanaRegex", () => {
  it("includeSeparationがtrueの場合、読点とクエスチョンも含む", () => {
    const regex = createKanaRegex(true);
    expect(regex.test("あいうえお、")).toBe(true);
    expect(regex.test("かきくけこ？")).toBe(true);
  });

  it("includeSeparationがfalseの場合、読点とクエスチョンを含まない", () => {
    const regex = createKanaRegex(false);
    expect(regex.test("あいうえお、")).toBe(false);
    expect(regex.test("かきくけこ？")).toBe(false);
  });
});

test("convertHiraToKana", () => {
  expect(convertHiraToKana("あいうえお")).toBe("アイウエオ");
  expect(convertHiraToKana("がぱをんー")).toBe("ガパヲンー");
});

test("convertLongVowel", () => {
  expect(convertLongVowel("アー")).toBe("アア");
  expect(convertLongVowel("ガー")).toBe("ガア");
  expect(convertLongVowel("ンー")).toBe("ンン");
});
