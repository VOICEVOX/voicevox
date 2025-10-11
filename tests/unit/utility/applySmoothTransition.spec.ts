import { describe, it, expect } from "vitest";
import { applySmoothTransition } from "@/sing/utility";

describe("applySmoothTransition", () => {
  it("jumpIndices に非整数を含むと例外を投げる", () => {
    const data = [0, 1, 2];
    expect(() => applySmoothTransition(data, [1.5], 6)).toThrow();
  });

  it("jumpIndex が 0 以下または data.length 以上だと例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() => applySmoothTransition([...data], [0], 6)).toThrow();
    expect(() => applySmoothTransition([...data], [data.length], 6)).toThrow();
  });

  it("jumpIndices が昇順でないと例外を投げる", () => {
    const data = [0, 1, 2, 3, 4, 5];
    expect(() => applySmoothTransition(data, [3, 1], 6)).toThrow();
  });

  it("jumpIndices に重複があると例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() => applySmoothTransition(data, [2, 2], 6)).toThrow();
  });

  it("maxTransitionLength が有限でないと例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() => applySmoothTransition(data, [2], NaN)).toThrow();
  });

  it("maxTransitionLength < 2 のとき例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() => applySmoothTransition(data, [2], 1.5)).toThrow();
  });

  it("jumpIndices が空ならデータは変更されない", () => {
    const data = [0, 1, 2, 3, 4];
    const before = [...data];

    applySmoothTransition(data, [], 6);

    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBe(before[i]);
    }
  });

  it("中央付近の単一ジャンプに対して、滑らかな遷移が適用される", () => {
    const data = [0, 0, 0, 0, 1, 1, 1, 1, 1];
    const jumpIndices = [4];
    const maxTransitionLength = 6;

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, maxTransitionLength);

    expect(actual).toMatchSnapshot();
  });

  it("先頭近くのジャンプでは、遷移がデータの端に合わせて切り詰められる", () => {
    const data = [0, 1, 1, 1, 1];
    const jumpIndices = [1];
    const maxTransitionLength = 6;

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, maxTransitionLength);

    expect(actual).toMatchSnapshot();
  });

  it("末尾近くのジャンプでは、遷移がデータの端に合わせて切り詰められる", () => {
    const data = [0, 0, 0, 0, 1];
    const jumpIndices = [4];
    const maxTransitionLength = 6;

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, maxTransitionLength);

    expect(actual).toMatchSnapshot();
  });

  it("十分に離れた複数のジャンプに対して、それぞれ独立に遷移が適用される", () => {
    const data = [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
    const jumpIndices = [3, 9];
    const maxTransitionLength = 6;

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, maxTransitionLength);

    expect(actual).toMatchSnapshot();
  });

  it("隣接するジャンプでは遷移長が自動的に縮小され重複が避けられる", () => {
    const data = [0, 0, 0, 1, 1, 1, 2, 2, 2];
    const jumpIndices = [3, 6];
    const maxTransitionLength = 6;

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, maxTransitionLength);

    expect(actual).toMatchSnapshot();
  });

  it("ジャンプサイズが0の場合は、データは変更されない", () => {
    const data = [0, 0, 0, 0, 0];
    const actual = [...data];

    applySmoothTransition(actual, [3], 6);

    for (let i = 0; i < actual.length; i++) {
      expect(actual[i]).toBe(data[i]);
    }
  });
});
