import { durationFormat, createSrtString } from "@/store/utility";

describe("Utility functions", () => {
  test("字幕ファイル用に時間を整形する", () => {
    expect(durationFormat(3661)).toBe("01:01:01,000");
    expect(durationFormat(60)).toBe("00:01:00,000");
    expect(durationFormat(3600)).toBe("01:00:00,000");
    expect(durationFormat(3661.123)).toBe("01:01:01,123");
    expect(durationFormat(60.987)).toBe("00:01:00,987");
    expect(durationFormat(3600.1357)).toBe("01:00:00,136");
  });

  test("createSrtStringは正しい字幕用文字列を作成する", () => {
    const serialNumber = 1;
    const start = "00:07:12,011";
    const end = "00:14:08,675";
    const speakerName = "四国 めたん";
    const text = "こんにちは世界!";
    const expectedSrtString =
      "1\n00:07:12,011 --> 00:14:08,675\n>> 四国 めたん: こんにちは世界!\n";
    expect(createSrtString(serialNumber, start, end, speakerName, text)).toBe(
      expectedSrtString
    );
    test("テキストが空白の場合", () => {
      const serialNumber = 1;
      const start = "00:00:00,000";
      const end = "00:00:00,000";
      const speakerName = "四国 めたん";
      const text = "";
      const expectedSrtString =
        "1\n00:00:00,000 --> 00:00:00,000\n>> 四国 めたん: \n";
      expect(createSrtString(serialNumber, start, end, speakerName, text)).toBe(
        expectedSrtString
      );
    });
  });
});
