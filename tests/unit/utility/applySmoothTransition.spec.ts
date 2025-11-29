import { describe, it, expect } from "vitest";
import { applySmoothTransition } from "@/sing/utility";

describe("applySmoothTransition", () => {
  it("jumpIndices に非整数を含むと例外を投げる", () => {
    const data = [0, 1, 2];
    expect(() =>
      applySmoothTransition(data, [1.5], [{ left: 3, right: 3 }]),
    ).toThrow();
  });

  it("jumpIndex が 0 以下または data.length 以上だと例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() =>
      applySmoothTransition([...data], [0], [{ left: 3, right: 3 }]),
    ).toThrow();
    expect(() =>
      applySmoothTransition([...data], [data.length], [{ left: 3, right: 3 }]),
    ).toThrow();
  });

  it("jumpIndices が昇順でないと例外を投げる", () => {
    const data = [0, 1, 2, 3, 4, 5];
    expect(() =>
      applySmoothTransition(
        data,
        [3, 1],
        [
          { left: 3, right: 3 },
          { left: 3, right: 3 },
        ],
      ),
    ).toThrow();
  });

  it("jumpIndices に重複があると例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() =>
      applySmoothTransition(
        data,
        [2, 2],
        [
          { left: 3, right: 3 },
          { left: 3, right: 3 },
        ],
      ),
    ).toThrow();
  });

  it("maxTransitionLengths の長さが jumpIndices と異なると例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() =>
      applySmoothTransition(
        data,
        [2],
        [
          { left: 3, right: 3 },
          { left: 3, right: 3 },
        ],
      ),
    ).toThrow();
  });

  it("遷移長が整数でないと例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() =>
      applySmoothTransition(data, [2], [{ left: NaN, right: 3 }]),
    ).toThrow();
    expect(() =>
      applySmoothTransition(data, [2], [{ left: 3, right: NaN }]),
    ).toThrow();
    expect(() =>
      applySmoothTransition(data, [2], [{ left: 1.5, right: 3 }]),
    ).toThrow();
    expect(() =>
      applySmoothTransition(data, [2], [{ left: 3, right: 2.7 }]),
    ).toThrow();
  });

  it("遷移長が負だと例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() =>
      applySmoothTransition(data, [2], [{ left: -1, right: 3 }]),
    ).toThrow();
    expect(() =>
      applySmoothTransition(data, [2], [{ left: 3, right: -1 }]),
    ).toThrow();
  });

  it("両方の遷移長が0だと例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() =>
      applySmoothTransition(data, [2], [{ left: 0, right: 0 }]),
    ).toThrow();
  });

  it("jumpIndices が空ならデータは変更されない", () => {
    const data = [0, 1, 2, 3, 4];
    const before = [...data];

    applySmoothTransition(data, [], []);

    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBe(before[i]);
    }
  });

  it("中央付近の単一ジャンプに対して、滑らかな遷移が適用される", () => {
    const data = [0, 0, 0, 0, 1, 1, 1, 1, 1];
    const jumpIndices = [4];

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, [{ left: 3, right: 3 }]);

    expect(actual).toMatchSnapshot();
  });

  it("先頭近くのジャンプでは、遷移がデータの端に合わせて切り詰められる", () => {
    const data = [0, 1, 1, 1, 1];
    const jumpIndices = [1];

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, [{ left: 3, right: 3 }]);

    expect(actual).toMatchSnapshot();
  });

  it("末尾近くのジャンプでは、遷移がデータの端に合わせて切り詰められる", () => {
    const data = [0, 0, 0, 0, 1];
    const jumpIndices = [4];

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, [{ left: 3, right: 3 }]);

    expect(actual).toMatchSnapshot();
  });

  it("十分に離れた複数のジャンプに対して、それぞれ独立に遷移が適用される", () => {
    const data = [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
    const jumpIndices = [3, 9];

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, [
      { left: 3, right: 3 },
      { left: 3, right: 3 },
    ]);

    expect(actual).toMatchSnapshot();
  });

  it("隣接するジャンプでは遷移長が距離に応じて自動的に縮小される", () => {
    const data = [0, 0, 0, 1, 1, 1, 2, 2, 2];
    const jumpIndices = [3, 6];

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, [
      { left: 3, right: 3 },
      { left: 3, right: 3 },
    ]);

    expect(actual).toMatchSnapshot();
  });

  it("左右で異なる遷移長を指定できる", () => {
    const data = [0, 0, 0, 0, 1, 1, 1, 1, 1];
    const jumpIndices = [4];

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, [{ left: 2, right: 4 }]);

    expect(actual).toMatchSnapshot();
  });

  it("各ジャンプで異なる遷移長を指定できる", () => {
    const data = [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
    const jumpIndices = [3, 9];

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, [
      { left: 2, right: 4 },
      { left: 4, right: 2 },
    ]);

    expect(actual).toMatchSnapshot();
  });

  it("ジャンプサイズが0の場合は、データは変更されない", () => {
    const data = [0, 0, 0, 0, 0];
    const actual = [...data];

    applySmoothTransition(actual, [3], [{ left: 3, right: 3 }]);

    for (let i = 0; i < actual.length; i++) {
      expect(actual[i]).toBe(data[i]);
    }
  });

  it("片方の遷移長が0でも正常に動作する（右側のみ）", () => {
    const data = [0, 0, 0, 1, 1, 1, 1];
    const actual = [...data];

    applySmoothTransition(actual, [3], [{ left: 0, right: 3 }]);

    expect(actual).toMatchSnapshot();
  });

  it("片方の遷移長が0でも正常に動作する（左側のみ）", () => {
    const data = [0, 0, 0, 1, 1, 1, 1];
    const actual = [...data];

    applySmoothTransition(actual, [3], [{ left: 3, right: 0 }]);

    expect(actual).toMatchSnapshot();
  });

  it("負のジャンプ（下降）にも対応する", () => {
    const data = [1, 1, 1, 1, 0, 0, 0, 0];
    const actual = [...data];

    applySmoothTransition(actual, [4], [{ left: 3, right: 3 }]);

    expect(actual).toMatchSnapshot();
  });

  it("浮動小数点数のデータに対しても正常に動作する", () => {
    const data = [0.5, 0.5, 0.5, 1.7, 1.7, 1.7];
    const actual = [...data];

    applySmoothTransition(actual, [3], [{ left: 2, right: 2 }]);

    expect(actual).toMatchSnapshot();
  });

  it("遷移長が配列ではなくオブジェクトで渡された場合、すべてのジャンプに同じ遷移長が適用される", () => {
    const data = [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
    const jumpIndices = [3, 9];

    const actual = [...data];
    applySmoothTransition(actual, jumpIndices, { left: 3, right: 3 });

    expect(actual).toMatchSnapshot();
  });
});
