import { describe, expect, test } from "vitest";
import { Mutex } from "@/helpers/mutex";

describe("mutex", () => {
  test("排他制御できる", async () => {
    const mutex = new Mutex({});
    let counter = 0;

    const increment = async () => {
      await using _lock = await mutex.acquire();
      const current = counter;
      // 時間のかかる処理
      await new Promise((resolve) => setTimeout(resolve, 10));
      counter = current + 1;
    };

    const tasks = [];
    for (let i = 0; i < 5; i++) {
      tasks.push(increment());
    }

    await Promise.all(tasks);
    expect(counter).toBe(5);
  });

  test("AsyncLockのオプションを使える", async () => {
    const mutex = new Mutex({ maxPending: 1 });
    let counter = 0;

    const increment = async () => {
      await using _lock = await mutex.acquire();
      const current = counter;
      // 時間のかかる処理
      await new Promise((resolve) => setTimeout(resolve, 10));
      counter = current + 1;
    };

    const tasks = [];
    for (let i = 0; i < 5; i++) {
      tasks.push(increment());
    }

    const waited = await Promise.allSettled(tasks);
    expect(waited.filter((t) => t.status === "fulfilled").length).toBe(2);
    expect(counter).toBe(2);
    expect(mutex.isLocked()).toBe(false);
  });

  test("isLockedでロック状態を取得できる", async () => {
    const mutex = new Mutex();
    expect(mutex.isLocked()).toBe(false);

    const lock = await mutex.acquire();
    expect(mutex.isLocked()).toBe(true);

    await lock.release();
    expect(mutex.isLocked()).toBe(false);
  });

  test("内部で例外が発生しても解放される", async () => {
    const mutex = new Mutex();
    let errorCaught = false;

    const task = async () => {
      await using _lock = await mutex.acquire();
      throw new Error("Test error");
    };

    try {
      const taskPromise = task();
      expect(mutex.isLocked()).toBe(true);
      await taskPromise;
    } catch {
      errorCaught = true;
    }

    expect(errorCaught).toBe(true);
    expect(mutex.isLocked()).toBe(false);
  });
});
