import { enablePatches, Immer } from "immer";
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
  expect(new_object2).toStrictEqual([1, 2]);
  applyPatches(new_object2, undoPatches2);
  expect(new_object2).toStrictEqual([1, 2, 3]);
  applyPatches(new_object2, redoPatches2);
  expect(new_object2).toStrictEqual([1, 2]);

  applyPatches(object2, redoPatches2);
  expect(object2).toStrictEqual([1, 2]);
  applyPatches(object2, undoPatches2);
  expect(object2).toStrictEqual([1, 2, 3]);
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

test("complextObject2", () => {
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
