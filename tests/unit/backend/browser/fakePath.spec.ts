import { isFakePath, createFakePath } from "@/backend/browser/fakePath";

it.each(["dummy", "日本語", "拡張子付き日本語.wav"])(
  "FakePathを作れて検証もできる: %s",
  (input) => {
    const fakePath = createFakePath(input);
    expect(isFakePath(fakePath)).toBe(true);
  },
);
