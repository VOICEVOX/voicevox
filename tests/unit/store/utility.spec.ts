import { extractExportText, extractYomiText } from "@/store/utility";

describe("extractExportTextとextractYomiText", () => {
  const memoText = "ダミー]ダミー[メモ]ダミー[ダミー";
  const rubyText = "ダミー|}ダミー{漢字|読み}ダミー{|ダミー";

  const text = memoText + rubyText;

  const expectedSkippedMemoText = "ダミー]ダミーダミー[ダミー";
  const expectedSkippedRubyExportText = "ダミー|}ダミー読みダミー{|ダミー";
  const expectedSkippedRubyYomiText = "ダミー|}ダミー漢字ダミー{|ダミー";

  it("無指定の場合はそのまま", () => {
    const param = {
      enableMemoNotation: false,
      enableRubyNotation: false,
    };
    expect(extractExportText(text, param)).toBe(text);
    expect(extractYomiText(text, param)).toBe(text);
  });

  it("メモをスキップ", () => {
    const param = {
      enableMemoNotation: true,
      enableRubyNotation: false,
    };
    expect(extractExportText(text, param)).toBe(
      expectedSkippedMemoText + rubyText
    );
    expect(extractYomiText(text, param)).toBe(
      expectedSkippedMemoText + rubyText
    );
  });

  it("ルビをスキップ", () => {
    const param = {
      enableMemoNotation: false,
      enableRubyNotation: true,
    };
    expect(extractExportText(text, param)).toBe(
      memoText + expectedSkippedRubyYomiText
    );
    expect(extractYomiText(text, param)).toBe(
      memoText + expectedSkippedRubyExportText
    );
  });

  it("メモとルビをスキップ", () => {
    const param = {
      enableMemoNotation: true,
      enableRubyNotation: true,
    };
    expect(extractExportText(text, param)).toBe(
      expectedSkippedMemoText + expectedSkippedRubyYomiText
    );
    expect(extractYomiText(text, param)).toBe(
      expectedSkippedMemoText + expectedSkippedRubyExportText
    );
  });
});
