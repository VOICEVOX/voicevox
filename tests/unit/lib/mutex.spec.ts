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
});
