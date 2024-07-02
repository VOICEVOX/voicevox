import { enableMapSet, enablePatches, Immer, Patch } from "immer";
import { applyPatches } from "@/store/immerPatch";

test("objectAdd", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();

  const object: { a: number; b: number; c?: number } = { a: 1, b: 2 };
  const [new_object, redoPatches, undoPatches] = immer.produceWithPatches(
    object,
    (obj) => {
      obj.c = 3;
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches).toStrictEqual([{ op: "add", path: ["c"], value: 3 }]);
  expect(undoPatches).toStrictEqual([{ op: "remove", path: ["c"] }]);

  expect(new_object).toStrictEqual({ a: 1, b: 2, c: 3 });
  applyPatches(new_object, undoPatches);
  expect(new_object).toStrictEqual({ a: 1, b: 2 });
  applyPatches(new_object, redoPatches);
  expect(new_object).toStrictEqual({ a: 1, b: 2, c: 3 });

  applyPatches(object, redoPatches);
  expect(object).toStrictEqual({ a: 1, b: 2, c: 3 });
  applyPatches(object, undoPatches);
  expect(object).toStrictEqual({ a: 1, b: 2 });
});

test("arrayAdd", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();

  const object1: number[] = [1, 2, 3];
  const [new_object1, redoPatches1, undoPatches1] = immer.produceWithPatches(
    object1,
    (obj) => {
      obj.push(4);
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches1).toStrictEqual([{ op: "add", path: [3], value: 4 }]);
  expect(undoPatches1).toStrictEqual([
    { op: "replace", path: ["length"], value: 3 },
  ]);

  expect(new_object1).toStrictEqual([1, 2, 3, 4]);
  applyPatches(new_object1, undoPatches1);
  expect(new_object1).toStrictEqual([1, 2, 3]);
  applyPatches(new_object1, redoPatches1);
  expect(new_object1).toStrictEqual([1, 2, 3, 4]);

  applyPatches(object1, redoPatches1);
  expect(object1).toStrictEqual([1, 2, 3, 4]);
  applyPatches(object1, undoPatches1);
  expect(object1).toStrictEqual([1, 2, 3]);

  const object2: number[] = [1, 2, 3];
  const [new_object2, redoPatches2, undoPatches2] = immer.produceWithPatches(
    object2,
    (obj) => {
      obj.splice(1, 0, 4);
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches2).toStrictEqual([
    { op: "replace", path: [1], value: 4 },
    { op: "replace", path: [2], value: 2 },
    { op: "add", path: [3], value: 3 },
  ]);
  expect(undoPatches2).toStrictEqual([
    { op: "replace", path: [1], value: 2 },
    { op: "replace", path: [2], value: 3 },
    { op: "replace", path: ["length"], value: 3 },
  ]);

  expect(new_object2).toStrictEqual([1, 4, 2, 3]);
  applyPatches(new_object2, undoPatches2);
  expect(new_object2).toStrictEqual([1, 2, 3]);
  applyPatches(new_object2, redoPatches2);
  expect(new_object2).toStrictEqual([1, 4, 2, 3]);

  applyPatches(object2, redoPatches2);
  expect(object2).toStrictEqual([1, 4, 2, 3]);
  applyPatches(object2, undoPatches2);
  expect(object2).toStrictEqual([1, 2, 3]);

  const object3: number[] = [1, 2, 3];
  const [new_object3, redoPatches3, undoPatches3] = immer.produceWithPatches(
    object3,
    (obj) => {
      obj.unshift(4);
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches3).toStrictEqual([
    { op: "replace", path: [0], value: 4 },
    { op: "replace", path: [1], value: 1 },
    { op: "replace", path: [2], value: 2 },
    { op: "add", path: [3], value: 3 },
  ]);
  expect(undoPatches3).toStrictEqual([
    { op: "replace", path: [0], value: 1 },
    { op: "replace", path: [1], value: 2 },
    { op: "replace", path: [2], value: 3 },
    { op: "replace", path: ["length"], value: 3 },
  ]);

  expect(new_object3).toStrictEqual([4, 1, 2, 3]);
  applyPatches(new_object3, undoPatches3);
  expect(new_object3).toStrictEqual([1, 2, 3]);
  applyPatches(new_object3, redoPatches3);
  expect(new_object3).toStrictEqual([4, 1, 2, 3]);

  applyPatches(object3, redoPatches3);
  expect(object3).toStrictEqual([4, 1, 2, 3]);
  applyPatches(object3, undoPatches3);
  expect(object3).toStrictEqual([1, 2, 3]);
});

test("objectReplace", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();

  const object: { a: number; b: number } = { a: 1, b: 2 };
  const [new_object, redoPatches, undoPatches] = immer.produceWithPatches(
    object,
    (obj) => {
      obj.a = 3;
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches).toStrictEqual([{ op: "replace", path: ["a"], value: 3 }]);
  expect(undoPatches).toStrictEqual([{ op: "replace", path: ["a"], value: 1 }]);

  expect(new_object).toStrictEqual({ a: 3, b: 2 });
  applyPatches(new_object, undoPatches);
  expect(new_object).toStrictEqual({ a: 1, b: 2 });
  applyPatches(new_object, redoPatches);
  expect(new_object).toStrictEqual({ a: 3, b: 2 });

  applyPatches(object, redoPatches);
  expect(object).toStrictEqual({ a: 3, b: 2 });
  applyPatches(object, undoPatches);
  expect(object).toStrictEqual({ a: 1, b: 2 });
});

test("arrayReplace", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();

  const object: number[] = [1, 2, 3];
  const [new_object, redoPatches, undoPatches] = immer.produceWithPatches(
    object,
    (obj) => {
      obj[1] = 4;
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches).toStrictEqual([{ op: "replace", path: [1], value: 4 }]);
  expect(undoPatches).toStrictEqual([{ op: "replace", path: [1], value: 2 }]);

  expect(new_object).toStrictEqual([1, 4, 3]);
  applyPatches(new_object, undoPatches);
  expect(new_object).toStrictEqual([1, 2, 3]);
  applyPatches(new_object, redoPatches);
  expect(new_object).toStrictEqual([1, 4, 3]);

  applyPatches(object, redoPatches);
  expect(object).toStrictEqual([1, 4, 3]);
  applyPatches(object, undoPatches);
  expect(object).toStrictEqual([1, 2, 3]);
});

test("objectRemove", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();

  const object: { a: number; b: number; c?: number } = { a: 1, b: 2, c: 3 };
  const [new_object, redoPatches, undoPatches] = immer.produceWithPatches(
    object,
    (obj) => {
      delete obj.c;
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches).toStrictEqual([{ op: "remove", path: ["c"] }]);
  expect(undoPatches).toStrictEqual([{ op: "add", path: ["c"], value: 3 }]);

  expect(new_object).toStrictEqual({ a: 1, b: 2 });
  applyPatches(new_object, undoPatches);
  expect(new_object).toStrictEqual({ a: 1, b: 2, c: 3 });
  applyPatches(new_object, redoPatches);
  expect(new_object).toStrictEqual({ a: 1, b: 2 });

  applyPatches(object, redoPatches);
  expect(object).toStrictEqual({ a: 1, b: 2 });
  applyPatches(object, undoPatches);
  expect(object).toStrictEqual({ a: 1, b: 2, c: 3 });
});

test("arrayRemove", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();

  const object1: number[] = [1, 2, 3];
  const [new_object1, redoPatches1, undoPatches1] = immer.produceWithPatches(
    object1,
    (obj) => {
      obj.splice(1, 1);
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches1).toStrictEqual([
    { op: "replace", path: [1], value: 3 },
    { op: "replace", path: ["length"], value: 2 },
  ]);
  expect(undoPatches1).toStrictEqual([
    { op: "replace", path: [1], value: 2 },
    { op: "add", path: [2], value: 3 },
  ]);

  expect(new_object1).toStrictEqual([1, 3]);
  applyPatches(new_object1, undoPatches1);
  expect(new_object1).toStrictEqual([1, 2, 3]);
  applyPatches(new_object1, redoPatches1);
  expect(new_object1).toStrictEqual([1, 3]);

  applyPatches(object1, redoPatches1);
  expect(object1).toStrictEqual([1, 3]);
  applyPatches(object1, undoPatches1);
  expect(object1).toStrictEqual([1, 2, 3]);

  const object2: number[] = [1, 2, 3];
  const [new_object2, redoPatches2, undoPatches2] = immer.produceWithPatches(
    object2,
    (obj) => {
      obj.pop();
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches2).toStrictEqual([
    { op: "replace", path: ["length"], value: 2 },
  ]);
  expect(undoPatches2).toStrictEqual([{ op: "add", path: [2], value: 3 }]);

  expect(new_object2).toStrictEqual([1, 2]);
  applyPatches(new_object2, undoPatches2);
  expect(new_object2).toStrictEqual([1, 2, 3]);
  applyPatches(new_object2, redoPatches2);
  expect(new_object2).toStrictEqual([1, 2]);

  applyPatches(object2, redoPatches2);
  expect(object2).toStrictEqual([1, 2]);
  applyPatches(object2, undoPatches2);
  expect(object2).toStrictEqual([1, 2, 3]);

  // immer 9.0.21において{ op: "remove" }を持つPatchがArrayに対して発行されないため、専用のテストケースを用意する
  const object3 = [1, 2, 3];
  const patch: Patch[] = [{ op: "remove", path: [1] }];
  applyPatches(object3, patch);
  expect(object3).toStrictEqual([1, 3]);

  const object4 = [1, 2, 3];
  const patch2: Patch[] = [{ op: "remove", path: [2] }];
  applyPatches(object4, patch2);
  expect(object4).toStrictEqual([1, 2]);

  const object5 = [1, 2, 3];
  const patch3: Patch[] = [{ op: "remove", path: [0] }];
  applyPatches(object5, patch3);
  expect(object5).toStrictEqual([2, 3]);
});

test("complexObject1", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();

  const object: {
    a: number;
    b: number;
    c: { d: number; e?: { f: string; g: [number, number] } };
  } = { a: 1, b: 2, c: { d: 3 } };
  const [new_object, redoPatches, undoPatches] = immer.produceWithPatches(
    object,
    (obj) => {
      obj.c.e = { f: "4", g: [5, 6] };
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches).toStrictEqual([
    { op: "add", path: ["c", "e"], value: { f: "4", g: [5, 6] } },
  ]);
  expect(undoPatches).toStrictEqual([{ op: "remove", path: ["c", "e"] }]);

  expect(new_object).toStrictEqual({
    a: 1,
    b: 2,
    c: { d: 3, e: { f: "4", g: [5, 6] } },
  });
  applyPatches(new_object, undoPatches);
  expect(new_object).toStrictEqual({ a: 1, b: 2, c: { d: 3 } });
  applyPatches(new_object, redoPatches);
  expect(new_object).toStrictEqual({
    a: 1,
    b: 2,
    c: { d: 3, e: { f: "4", g: [5, 6] } },
  });

  applyPatches(object, redoPatches);
  expect(object).toStrictEqual({
    a: 1,
    b: 2,
    c: { d: 3, e: { f: "4", g: [5, 6] } },
  });
  applyPatches(object, undoPatches);
  expect(object).toStrictEqual({ a: 1, b: 2, c: { d: 3 } });
});

test("complexObject2", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();

  const object: {
    a: number;
    b: number;
    c: { d: number; e: { f: string; g: [number, number] } };
  } = { a: 1, b: 2, c: { d: 3, e: { f: "4", g: [5, 6] } } };
  const [new_object, redoPatches, undoPatches] = immer.produceWithPatches(
    object,
    (obj) => {
      obj.c.e.g[0] = 7;
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches).toStrictEqual([
    { op: "replace", path: ["c", "e", "g", 0], value: 7 },
  ]);
  expect(undoPatches).toStrictEqual([
    { op: "replace", path: ["c", "e", "g", 0], value: 5 },
  ]);

  expect(new_object).toStrictEqual({
    a: 1,
    b: 2,
    c: { d: 3, e: { f: "4", g: [7, 6] } },
  });
  applyPatches(new_object, undoPatches);
  expect(new_object).toStrictEqual({
    a: 1,
    b: 2,
    c: { d: 3, e: { f: "4", g: [5, 6] } },
  });
  applyPatches(new_object, redoPatches);
  expect(new_object).toStrictEqual({
    a: 1,
    b: 2,
    c: { d: 3, e: { f: "4", g: [7, 6] } },
  });

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

test("complexObject3", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();

  const object: {
    a: number;
    b: number;
    c: { d: number; e: { f: string; g?: [number, number] } };
  } = { a: 1, b: 2, c: { d: 3, e: { f: "4", g: [5, 6] } } };
  const [new_object, redoPatches, undoPatches] = immer.produceWithPatches(
    object,
    (obj) => {
      delete obj.c.e.g;
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches).toStrictEqual([{ op: "remove", path: ["c", "e", "g"] }]);
  expect(undoPatches).toStrictEqual([
    { op: "add", path: ["c", "e", "g"], value: [5, 6] },
  ]);

  expect(new_object).toStrictEqual({ a: 1, b: 2, c: { d: 3, e: { f: "4" } } });
  applyPatches(new_object, undoPatches);
  expect(new_object).toStrictEqual({
    a: 1,
    b: 2,
    c: { d: 3, e: { f: "4", g: [5, 6] } },
  });
  applyPatches(new_object, redoPatches);
  expect(new_object).toStrictEqual({ a: 1, b: 2, c: { d: 3, e: { f: "4" } } });

  applyPatches(object, redoPatches);
  expect(object).toStrictEqual({ a: 1, b: 2, c: { d: 3, e: { f: "4" } } });
  applyPatches(object, undoPatches);
  expect(object).toStrictEqual({
    a: 1,
    b: 2,
    c: { d: 3, e: { f: "4", g: [5, 6] } },
  });
});

test("map", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();
  enableMapSet();

  const object1: Map<number, number> = new Map([
    [1, 2],
    [3, 4],
  ]);
  const [new_object1, redoPatches1, undoPatches1] = immer.produceWithPatches(
    object1,
    (obj) => {
      obj.set(3, 5);
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches1).toStrictEqual([{ op: "replace", path: [3], value: 5 }]);
  expect(undoPatches1).toStrictEqual([{ op: "replace", path: [3], value: 4 }]);

  expect(new_object1).toStrictEqual(
    new Map([
      [1, 2],
      [3, 5],
    ]),
  );
  applyPatches(new_object1, undoPatches1);
  expect(new_object1).toStrictEqual(
    new Map([
      [1, 2],
      [3, 4],
    ]),
  );
  applyPatches(new_object1, redoPatches1);
  expect(new_object1).toStrictEqual(
    new Map([
      [1, 2],
      [3, 5],
    ]),
  );

  applyPatches(object1, redoPatches1);
  expect(object1).toStrictEqual(
    new Map([
      [1, 2],
      [3, 5],
    ]),
  );
  applyPatches(object1, undoPatches1);
  expect(object1).toStrictEqual(
    new Map([
      [1, 2],
      [3, 4],
    ]),
  );

  const object2: Map<number, number> = new Map([
    [1, 2],
    [3, 4],
  ]);
  const [new_object2, redoPatches2, undoPatches2] = immer.produceWithPatches(
    object2,
    (obj) => {
      obj.set(5, 6);
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches2).toStrictEqual([{ op: "add", path: [5], value: 6 }]);
  expect(undoPatches2).toStrictEqual([{ op: "remove", path: [5] }]);

  expect(new_object2).toStrictEqual(
    new Map([
      [1, 2],
      [3, 4],
      [5, 6],
    ]),
  );
  applyPatches(new_object2, undoPatches2);
  expect(new_object2).toStrictEqual(
    new Map([
      [1, 2],
      [3, 4],
    ]),
  );
  applyPatches(new_object2, redoPatches2);
  expect(new_object2).toStrictEqual(
    new Map([
      [1, 2],
      [3, 4],
      [5, 6],
    ]),
  );

  applyPatches(object2, redoPatches2);
  expect(object2).toStrictEqual(
    new Map([
      [1, 2],
      [3, 4],
      [5, 6],
    ]),
  );
  applyPatches(object2, undoPatches2);
  expect(object2).toStrictEqual(
    new Map([
      [1, 2],
      [3, 4],
    ]),
  );
});

test("set", () => {
  const immer = new Immer();
  immer.setAutoFreeze(false);
  enablePatches();
  enableMapSet();

  const object: Set<number> = new Set([1, 2, 3]);
  const [new_object, redoPatches, undoPatches] = immer.produceWithPatches(
    object,
    (obj) => {
      obj.delete(2);
    },
  );
  // patchに対するテストはテストケースの可視化のためのものです failした場合はその通りに書き替えてください
  expect(redoPatches).toStrictEqual([{ op: "remove", path: [1], value: 2 }]);
  expect(undoPatches).toStrictEqual([{ op: "add", path: [1], value: 2 }]);

  expect(new_object).toStrictEqual(new Set([1, 3]));
  applyPatches(new_object, undoPatches);
  expect(new_object).toStrictEqual(new Set([1, 2, 3]));
  applyPatches(new_object, redoPatches);
  expect(new_object).toStrictEqual(new Set([1, 3]));

  applyPatches(object, redoPatches);
  expect(object).toStrictEqual(new Set([1, 3]));
  applyPatches(object, undoPatches);
  expect(object).toStrictEqual(new Set([1, 2, 3]));
});

test("expect-throws", () => {
  expect(() => {
    applyPatches({}, [{ op: "add", path: ["a", "b"], value: 1 }]);
  }).toThrow();
  expect(() => {
    applyPatches({}, [{ op: "add", path: ["a", "b", "c"], value: 1 }]);
  }).toThrow();
  expect(() => {
    applyPatches([], [{ op: "replace", path: [0, "a"], value: 1 }]);
  }).toThrow();
});
