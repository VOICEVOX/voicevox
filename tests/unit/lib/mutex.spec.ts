import { describe, expect, it } from "vitest";
import { Mutex } from "@/helpers/mutex";

describe("mutex", () => {
  it("prevents concurrent access", async () => {
    const mutex = new Mutex({});
    let counter = 0;

    const increment = async () => {
      await using _lock = await mutex.acquire();
      const current = counter;
      // Simulate some async work
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

  it("accepts AsyncLock's options", async () => {
    const mutex = new Mutex({ maxPending: 1 });
    let counter = 0;

    const increment = async () => {
      await using _lock = await mutex.acquire();
      const current = counter;
      // Simulate some async work
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
