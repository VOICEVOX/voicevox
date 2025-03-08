import { enableMapSet, enablePatches, Immer, Patch } from "immer";
import { applyPatches } from "@/store/immerPatchUtility";

describe("object", () => {
  test("add/remove - 1", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: { a: number; b: number; c?: number } = { a: 1, b: 2 };
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.c = 3;
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([{ op: "add", path: ["c"], value: 3 }]);
    expect(undoPatches).toStrictEqual([{ op: "remove", path: ["c"] }]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual({ a: 1, b: 2, c: 3 });
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual({ a: 1, b: 2 });
  });

  test("add/remove - 2", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: { a: number; b: number; c?: number } = { a: 1, b: 2, c: 3 };
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        delete obj.c;
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([{ op: "remove", path: ["c"] }]);
    expect(undoPatches).toStrictEqual([{ op: "add", path: ["c"], value: 3 }]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual({ a: 1, b: 2 });
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual({ a: 1, b: 2, c: 3 });
  });

  test("replace", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: { a: number; b: number } = { a: 1, b: 2 };
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.a = 3;
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([
      { op: "replace", path: ["a"], value: 3 },
    ]);
    expect(undoPatches).toStrictEqual([
      { op: "replace", path: ["a"], value: 1 },
    ]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual({ a: 3, b: 2 });
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual({ a: 1, b: 2 });
  });
});

describe("array", () => {
  test("add/replace - 1", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: number[] = [1, 2, 3];
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.push(4);
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([{ op: "add", path: [3], value: 4 }]);
    expect(undoPatches).toStrictEqual([
      { op: "replace", path: ["length"], value: 3 },
    ]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual([1, 2, 3, 4]);
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual([1, 2, 3]);
  });

  test("add/replace - 2", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: number[] = [1, 2, 3];
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.splice(1, 0, 4);
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([
      { op: "replace", path: [1], value: 4 },
      { op: "replace", path: [2], value: 2 },
      { op: "add", path: [3], value: 3 },
    ]);
    expect(undoPatches).toStrictEqual([
      { op: "replace", path: [1], value: 2 },
      { op: "replace", path: [2], value: 3 },
      { op: "replace", path: ["length"], value: 3 },
    ]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual([1, 4, 2, 3]);
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual([1, 2, 3]);
  });

  test("add/replace - 3", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: number[] = [1, 2, 3];
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.unshift(4);
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([
      { op: "replace", path: [0], value: 4 },
      { op: "replace", path: [1], value: 1 },
      { op: "replace", path: [2], value: 2 },
      { op: "add", path: [3], value: 3 },
    ]);
    expect(undoPatches).toStrictEqual([
      { op: "replace", path: [0], value: 1 },
      { op: "replace", path: [1], value: 2 },
      { op: "replace", path: [2], value: 3 },
      { op: "replace", path: ["length"], value: 3 },
    ]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual([4, 1, 2, 3]);
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual([1, 2, 3]);
  });

  test("add/replace - 4", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: number[] = [1, 2, 3];
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.splice(1, 1);
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([
      { op: "replace", path: [1], value: 3 },
      { op: "replace", path: ["length"], value: 2 },
    ]);
    expect(undoPatches).toStrictEqual([
      { op: "replace", path: [1], value: 2 },
      { op: "add", path: [2], value: 3 },
    ]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual([1, 3]);
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual([1, 2, 3]);
  });

  test("add/replace - 5", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: number[] = [1, 2, 3];
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.pop();
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([
      { op: "replace", path: ["length"], value: 2 },
    ]);
    expect(undoPatches).toStrictEqual([{ op: "add", path: [2], value: 3 }]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual([1, 2]);
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual([1, 2, 3]);
  });

  test("add - 1", () => {
    // pathとして"-"を渡した際の挙動はRFC6902に規定されているが、現バージョンのimmerはこのpathを生成しないため専用のテストケースを用意する
    const object = [1, 2, 3];
    const patch: Patch[] = [{ op: "add", path: ["-"], value: 4 }];
    applyPatches(object, patch);
    expect(object).toStrictEqual([1, 2, 3, 4]);
  });

  test("add - 2", () => {
    // pathとして配列のlength未満の値を渡した際はinsertが行われることが期待される(RFC6902にてそのように規定されており、immerのapplyPatchesもそのような動作をする)
    // 現バージョンのimmerはこのpathを生成しないため専用のテストケースを用意する
    const object = [1, 2, 3];
    const patch: Patch[] = [{ op: "add", path: [1], value: 4 }];
    applyPatches(object, patch);
    expect(object).toStrictEqual([1, 4, 2, 3]);
  });

  test("replace", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: number[] = [1, 2, 3];
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj[1] = 4;
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([{ op: "replace", path: [1], value: 4 }]);
    expect(undoPatches).toStrictEqual([{ op: "replace", path: [1], value: 2 }]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual([1, 4, 3]);
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual([1, 2, 3]);
  });

  // immer 9.0.21において{ op: "remove" }を持つPatchがArrayに対して発行されないため、専用のテストケースを用意する
  test("remove - 1", () => {
    const object = [1, 2, 3];
    const patch: Patch[] = [{ op: "remove", path: [1] }];
    applyPatches(object, patch);
    expect(object).toStrictEqual([1, 3]);
  });

  test("remove - 2", () => {
    const object = [1, 2, 3];
    const patch: Patch[] = [{ op: "remove", path: [2] }];
    applyPatches(object, patch);
    expect(object).toStrictEqual([1, 2]);
  });

  test("remove - 3", () => {
    const object = [1, 2, 3];
    const patch: Patch[] = [{ op: "remove", path: [0] }];
    applyPatches(object, patch);
    expect(object).toStrictEqual([2, 3]);
  });
});

describe("complexObject", () => {
  test("complexObject - 1", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: {
      a: number;
      b: number;
      c: { d: number; e?: { f: string; g: [number, number] } };
    } = { a: 1, b: 2, c: { d: 3 } };
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.c.e = { f: "4", g: [5, 6] };
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([
      { op: "add", path: ["c", "e"], value: { f: "4", g: [5, 6] } },
    ]);
    expect(undoPatches).toStrictEqual([{ op: "remove", path: ["c", "e"] }]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual({
      a: 1,
      b: 2,
      c: { d: 3, e: { f: "4", g: [5, 6] } },
    });
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual({ a: 1, b: 2, c: { d: 3 } });
  });

  test("complexObject - 2", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: {
      a: number;
      b: number;
      c: { d: number; e: { f: string; g: [number, number] } };
    } = { a: 1, b: 2, c: { d: 3, e: { f: "4", g: [5, 6] } } };
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.c.e.g[0] = 7;
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([
      { op: "replace", path: ["c", "e", "g", 0], value: 7 },
    ]);
    expect(undoPatches).toStrictEqual([
      { op: "replace", path: ["c", "e", "g", 0], value: 5 },
    ]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual({
      a: 1,
      b: 2,
      c: { d: 3, e: { f: "4", g: [7, 6] } },
    });
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual({
      a: 1,
      b: 2,
      c: { d: 3, e: { f: "4", g: [5, 6] } },
    });
  });

  test("complexObject - 3", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();

    const object: {
      a: number;
      b: number;
      c: { d: number; e: { f: string; g?: [number, number] } };
    } = { a: 1, b: 2, c: { d: 3, e: { f: "4", g: [5, 6] } } };
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        delete obj.c.e.g;
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([
      { op: "remove", path: ["c", "e", "g"] },
    ]);
    expect(undoPatches).toStrictEqual([
      { op: "add", path: ["c", "e", "g"], value: [5, 6] },
    ]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual({ a: 1, b: 2, c: { d: 3, e: { f: "4" } } });
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual({
      a: 1,
      b: 2,
      c: { d: 3, e: { f: "4", g: [5, 6] } },
    });
  });
});

describe("Map", () => {
  test("add/remove", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();
    enableMapSet();

    const object = new Map<number, number>([
      [1, 2],
      [3, 4],
    ]);
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.set(5, 6);
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([{ op: "add", path: [5], value: 6 }]);
    expect(undoPatches).toStrictEqual([{ op: "remove", path: [5] }]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual(
      new Map([
        [1, 2],
        [3, 4],
        [5, 6],
      ]),
    );
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual(
      new Map([
        [1, 2],
        [3, 4],
      ]),
    );
  });

  test("replace", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();
    enableMapSet();

    const object = new Map<number, number>([
      [1, 2],
      [3, 4],
    ]);
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.set(3, 5);
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([{ op: "replace", path: [3], value: 5 }]);
    expect(undoPatches).toStrictEqual([{ op: "replace", path: [3], value: 4 }]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual(
      new Map([
        [1, 2],
        [3, 5],
      ]),
    );
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual(
      new Map([
        [1, 2],
        [3, 4],
      ]),
    );
  });
});

describe("Set", () => {
  test("add/remove", () => {
    const immer = new Immer();
    immer.setAutoFreeze(false);
    enablePatches();
    enableMapSet();

    const object = new Set<number>([1, 2, 3]);
    const [, redoPatches, undoPatches] = immer.produceWithPatches(
      object,
      (obj) => {
        obj.delete(2);
      },
    );
    // テストケースの可視化
    expect(redoPatches).toStrictEqual([{ op: "remove", path: [1], value: 2 }]);
    expect(undoPatches).toStrictEqual([{ op: "add", path: [1], value: 2 }]);

    applyPatches(object, redoPatches);
    expect(object).toStrictEqual(new Set([1, 3]));
    applyPatches(object, undoPatches);
    expect(object).toStrictEqual(new Set([1, 2, 3]));
  });
});

test("expect-throws", () => {
  // pathを辿っている途中で存在しないプロパティにアクセスしようとした場合例外が発生する
  expect(() => {
    applyPatches({}, [{ op: "add", path: ["a", "b"], value: 1 }]);
  }).toThrow();
  expect(() => {
    applyPatches({ a: {} }, [
      { op: "remove", path: ["a", "b", "c"], value: 1 },
    ]);
  }).toThrow();
  expect(() => {
    applyPatches({ a: [] }, [
      { op: "replace", path: ["a", "b", "c", "d"], value: 1 },
    ]);
  }).toThrow();
  expect(() => {
    applyPatches([], [{ op: "add", path: [0, "a"], value: 1 }]);
  }).toThrow();
  expect(() => {
    applyPatches([{}], [{ op: "remove", path: [0, "a", "b"], value: 1 }]);
  }).toThrow();
  expect(() => {
    applyPatches({ a: [] }, [
      { op: "replace", path: ["a", 0, "b", "c"], value: 1 },
    ]);
  }).toThrow();
});

describe("unsupported", () => {
  test("userClass", () => {
    class MyClass {}

    expect(() => {
      applyPatches({}, [{ op: "add", path: ["a"], value: new MyClass() }]);
    }).toThrow();
  });

  test("un-cloneable", () => {
    expect(() => {
      applyPatches({}, [{ op: "add", path: ["a"], value: () => {} }]);
    }).toThrow();
  });
});
