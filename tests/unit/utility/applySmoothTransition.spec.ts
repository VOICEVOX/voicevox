import { describe, it, expect } from "vitest";
import { applySmoothTransitions } from "@/sing/utility";

const smoothStep = (x: number) => {
  const clampedX = Math.min(1.0, Math.max(0.0, x));
  return clampedX * clampedX * (3.0 - 2.0 * clampedX);
};

const applySingleTransition = (
  data: number[],
  jumpIndex: number,
  transitionLengths: { left: number; right: number },
) => {
  const jumpSize = data[jumpIndex] - data[jumpIndex - 1];
  const jumpCenter = jumpIndex - 0.5;
  const transitionStart = jumpCenter - transitionLengths.left;
  const transitionEnd = jumpCenter + transitionLengths.right;
  const totalTransitionLength =
    transitionLengths.left + transitionLengths.right;

  const startIndex = Math.ceil(transitionStart);
  const endIndex = Math.min(data.length, Math.floor(transitionEnd) + 1);

  if (startIndex < 0 || endIndex > data.length) {
    throw new Error("Transition range is out of data bounds.");
  }

  for (let j = startIndex; j < endIndex; j++) {
    const normalizedPosition = (j - transitionStart) / totalTransitionLength;
    const weight = smoothStep(normalizedPosition);

    if (j < jumpCenter) {
      data[j] += jumpSize * weight;
    } else {
      data[j] -= jumpSize * (1 - weight);
    }
  }
};

describe("applySmoothTransitions", () => {
  it("jumpIndices に非整数を含むと例外を投げる", () => {
    const data = [0, 1, 2];
    expect(() =>
      applySmoothTransitions(data, [1.5], [{ left: 3, right: 3 }]),
    ).toThrow();
  });

  it("jumpIndex が 0 以下または data.length 以上だと例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() =>
      applySmoothTransitions([...data], [0], [{ left: 3, right: 3 }]),
    ).toThrow();
    expect(() =>
      applySmoothTransitions([...data], [data.length], [{ left: 3, right: 3 }]),
    ).toThrow();
  });

  it("jumpIndices が昇順でないと例外を投げる", () => {
    const data = [0, 1, 2, 3, 4, 5];
    expect(() =>
      applySmoothTransitions(
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
      applySmoothTransitions(
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
      applySmoothTransitions(
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
      applySmoothTransitions(data, [2], [{ left: NaN, right: 3 }]),
    ).toThrow();
    expect(() =>
      applySmoothTransitions(data, [2], [{ left: 3, right: NaN }]),
    ).toThrow();
    expect(() =>
      applySmoothTransitions(data, [2], [{ left: 1.5, right: 3 }]),
    ).toThrow();
    expect(() =>
      applySmoothTransitions(data, [2], [{ left: 3, right: 2.7 }]),
    ).toThrow();
  });

  it("遷移長が負だと例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() =>
      applySmoothTransitions(data, [2], [{ left: -1, right: 3 }]),
    ).toThrow();
    expect(() =>
      applySmoothTransitions(data, [2], [{ left: 3, right: -1 }]),
    ).toThrow();
  });

  it("両方の遷移長が0だと例外を投げる", () => {
    const data = [0, 1, 2, 3];
    expect(() =>
      applySmoothTransitions(data, [2], [{ left: 0, right: 0 }]),
    ).toThrow();
  });

  it("jumpIndices が空ならデータは変更されない", () => {
    const data = [0, 1, 2, 3, 4];
    const before = [...data];

    applySmoothTransitions(data, [], []);

    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBe(before[i]);
    }
  });

  it("ジャンプサイズが0の場合は、データは変更されない", () => {
    const data = [0, 0, 0, 0, 0];
    const actual = [...data];

    applySmoothTransitions(actual, [3], [{ left: 3, right: 3 }]);

    for (let i = 0; i < actual.length; i++) {
      expect(actual[i]).toBe(data[i]);
    }
  });

  it("中央付近の単一ジャンプに対して、滑らかな遷移が適用される", () => {
    const data = [0, 0, 0, 0, 1, 1, 1, 1, 1];
    const jumpIndices = [4];

    const manualExpected = [...data];
    for (let i = 0; i < 6; i++) {
      manualExpected[1 + i] = smoothStep((i + 0.5) / 6);
    }

    const helperExpected = [...data];
    applySingleTransition(helperExpected, 4, { left: 3, right: 3 });

    const actual = [...data];
    applySmoothTransitions(actual, jumpIndices, [{ left: 3, right: 3 }]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(manualExpected[i], 6);
      expect(actual[i]).toBeCloseTo(helperExpected[i], 6);
    }
  });

  it("負のジャンプ（下降）にも対応する", () => {
    const data = [1, 1, 1, 1, 0, 0, 0, 0];
    const actual = [...data];

    const manualExpected = [...data];
    for (let i = 0; i < 6; i++) {
      manualExpected[1 + i] = 1 - smoothStep((i + 0.5) / 6);
    }

    const helperExpected = [...data];
    applySingleTransition(helperExpected, 4, { left: 3, right: 3 });

    applySmoothTransitions(actual, [4], [{ left: 3, right: 3 }]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(manualExpected[i], 6);
      expect(actual[i]).toBeCloseTo(helperExpected[i], 6);
    }
  });

  it("浮動小数点数のデータに対しても正常に動作する", () => {
    const data = [0.5, 0.5, 0.5, 1.7, 1.7, 1.7];
    const actual = [...data];

    const manualExpected = [...data];
    const jumpSize = data[3] - data[2];
    for (let i = 0; i < 4; i++) {
      manualExpected[1 + i] = 0.5 + jumpSize * smoothStep((i + 0.5) / 4);
    }

    const helperExpected = [...data];
    applySingleTransition(helperExpected, 3, { left: 2, right: 2 });

    applySmoothTransitions(actual, [3], [{ left: 2, right: 2 }]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(manualExpected[i], 6);
      expect(actual[i]).toBeCloseTo(helperExpected[i], 6);
    }
  });

  it("左右で異なる遷移長を指定できる", () => {
    const data = [0, 0, 0, 0, 1, 1, 1, 1, 1];
    const jumpIndices = [4];

    const manualExpected = [...data];
    for (let i = 0; i < 5; i++) {
      manualExpected[3 + i] = smoothStep((i + 0.5) / 5);
    }

    const helperExpected = [...data];
    applySingleTransition(helperExpected, 4, { left: 1, right: 4 });

    const actual = [...data];
    applySmoothTransitions(actual, jumpIndices, [{ left: 1, right: 4 }]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(manualExpected[i], 6);
      expect(actual[i]).toBeCloseTo(helperExpected[i], 6);
    }
  });

  it("各ジャンプで異なる遷移長を指定できる", () => {
    const data = [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
    const jumpIndices = [3, 9];

    const expected = [...data];
    applySingleTransition(expected, 3, { left: 2, right: 4 });
    applySingleTransition(expected, 9, { left: 4, right: 2 });

    const actual = [...data];
    applySmoothTransitions(actual, jumpIndices, [
      { left: 2, right: 4 },
      { left: 4, right: 2 },
    ]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(expected[i], 6);
    }
  });

  it("片方の遷移長が0でも正常に動作する（右側のみ）", () => {
    const data = [0, 0, 0, 1, 1, 1, 1];
    const actual = [...data];

    const manualExpected = [...data];
    for (let i = 0; i < 3; i++) {
      manualExpected[3 + i] = smoothStep((i + 0.5) / 3);
    }

    const helperExpected = [...data];
    applySingleTransition(helperExpected, 3, { left: 0, right: 3 });

    applySmoothTransitions(actual, [3], [{ left: 0, right: 3 }]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(manualExpected[i], 6);
      expect(actual[i]).toBeCloseTo(helperExpected[i], 6);
    }
  });

  it("片方の遷移長が0でも正常に動作する（左側のみ）", () => {
    const data = [0, 0, 0, 1, 1, 1, 1];
    const actual = [...data];

    const manualExpected = [...data];
    for (let i = 0; i < 3; i++) {
      manualExpected[i] = smoothStep((i + 0.5) / 3);
    }

    const helperExpected = [...data];
    applySingleTransition(helperExpected, 3, { left: 3, right: 0 });

    applySmoothTransitions(actual, [3], [{ left: 3, right: 0 }]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(manualExpected[i], 6);
      expect(actual[i]).toBeCloseTo(helperExpected[i], 6);
    }
  });

  it("遷移長が配列ではなくオブジェクトで渡された場合、すべてのジャンプに同じ遷移長が適用される", () => {
    const data = [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
    const jumpIndices = [3, 9];

    const expected = [...data];
    applySingleTransition(expected, 3, { left: 3, right: 3 });
    applySingleTransition(expected, 9, { left: 3, right: 3 });

    const actual = [...data];
    applySmoothTransitions(actual, jumpIndices, { left: 3, right: 3 });

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(expected[i], 6);
    }
  });

  it("先頭近くのジャンプでは、遷移がデータの端に合わせて切り詰められる", () => {
    const data = [0, 1, 1, 1, 1];
    const jumpIndices = [1];

    const expected = [...data];
    applySingleTransition(expected, 1, { left: 1, right: 3 });

    const actual = [...data];
    applySmoothTransitions(actual, jumpIndices, [{ left: 3, right: 3 }]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(expected[i], 6);
    }
  });

  it("末尾近くのジャンプでは、遷移がデータの端に合わせて切り詰められる", () => {
    const data = [0, 0, 0, 0, 1];
    const jumpIndices = [4];

    const expected = [...data];
    applySingleTransition(expected, 4, { left: 3, right: 1 });

    const actual = [...data];
    applySmoothTransitions(actual, jumpIndices, [{ left: 3, right: 3 }]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(expected[i], 6);
    }
  });

  it("十分に離れた複数のジャンプに対して、それぞれ独立に遷移が適用される", () => {
    const data = [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2];
    const jumpIndices = [3, 9];

    const expected = [...data];
    applySingleTransition(expected, 3, { left: 3, right: 3 });
    applySingleTransition(expected, 9, { left: 3, right: 3 });

    const actual = [...data];
    applySmoothTransitions(actual, jumpIndices, [
      { left: 3, right: 3 },
      { left: 3, right: 3 },
    ]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(expected[i], 6);
    }
  });

  it("隣接するジャンプの遷移区間が重なる場合、重複して適用される", () => {
    const data = [0, 0, 0, 1, 1, 1, 2, 2, 2];
    const jumpIndices = [3, 6];

    const expected = [...data];
    applySingleTransition(expected, 3, { left: 3, right: 3 });
    applySingleTransition(expected, 6, { left: 3, right: 3 });

    const actual = [...data];
    applySmoothTransitions(actual, jumpIndices, [
      { left: 3, right: 3 },
      { left: 3, right: 3 },
    ]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(expected[i], 6);
    }
  });

  it("隣接するジャンプの距離が遷移長より短い場合、遷移長が距離に応じて自動的に縮小される", () => {
    const data = [0, 0, 0, 1, 2, 2, 2, 2, 2];
    const jumpIndices = [3, 4];

    const expected = [...data];
    applySingleTransition(expected, 3, { left: 3, right: 1 });
    applySingleTransition(expected, 4, { left: 1, right: 3 });

    const actual = [...data];
    applySmoothTransitions(actual, jumpIndices, [
      { left: 3, right: 3 },
      { left: 3, right: 3 },
    ]);

    for (let i = 0; i < data.length; i++) {
      expect(actual[i]).toBeCloseTo(expected[i], 6);
    }
  });
});
