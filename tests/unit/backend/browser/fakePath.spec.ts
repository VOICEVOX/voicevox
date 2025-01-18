import { isFakePath, createFakePath } from "@/backend/browser/fakePath";

it.each([
  "spaced file name",
  "filename-with-extension.wav",
  "日本語ファイル名",
])("FakePathを作れて検証もできる: %s", (input) => {
  const fakePath = createFakePath(input);
  expect(isFakePath(fakePath)).toBe(true);
});
