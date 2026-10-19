import { describe, expect, test } from "vitest";
import { AbortableMutex } from "@/helpers/abortableMutex";

async function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("AbortableMutex", () => {
  test("コールバックの戻り値を返す", async () => {
    const mutex = new AbortableMutex();
    const uniqueValue = Symbol("unique");
    await expect(mutex.lock(async () => uniqueValue)).resolves.toBe(
      uniqueValue,
    );
  });

  test("前の処理の終了前に複数の処理を要求すると、最後の要求以外は中断される", async () => {
    const mutex = new AbortableMutex();
    const longTask = Promise.withResolvers<void>();
    const events: string[] = [];
    const signals: AbortSignal[] = [];

    // 処理1
    void mutex.lock(async (signal) => {
      signals.push(signal);
      events.push("first");

      // 中断不可の時間のかかる処理
      await longTask.promise;
      events.push("firstDone");
    });
    // この時点では処理1が実行中

    // ここで処理1にAbortSignalが送られるはず
    // 処理2
    void mutex.lock(async (signal) => {
      signals.push(signal);
      events.push("second");
    });
    // 処理3
    const third = mutex.lock(async (signal) => {
      signals.push(signal);
      events.push("third");
    });

    await flushPromises();
    expect(events).toEqual(["first"]);
    expect(signals.map((signal) => signal.aborted)).toEqual([true]);

    // 後処理を終了させる、この時点で処理2が実行されて同時に処理2がabortされ、処理3が実行されるはず
    longTask.resolve();
    await third;

    expect(events).toEqual(["first", "firstDone", "second", "third"]);
    expect(signals.map((signal) => signal.aborted)).toEqual([
      true,
      true,
      false,
    ]);
  });

  test("前の処理が失敗しても次の処理は実行できる", async () => {
    const mutex = new AbortableMutex();
    const first = mutex.lock(async () => {
      throw new Error("処理失敗");
    });
    const second = mutex.lock(async () => true);

    await expect(first).rejects.toThrow("処理失敗");
    await expect(second).resolves.toBe(true);
  });

  test("abortは実行中の処理を中断し、後始末の完了を待つ", async () => {
    const mutex = new AbortableMutex();
    const cleanup = Promise.withResolvers<void>();
    let taskSignal: AbortSignal | undefined;
    void mutex.lock(async (signal) => {
      taskSignal = signal;
      await cleanup.promise;
    });

    // この時点では処理が実行中で、abortされていない
    await flushPromises();
    expect(taskSignal?.aborted).toBe(false);

    let abortDone = false;
    const abort = mutex.abort().then(() => {
      abortDone = true;
    });

    // この時点で処理が中断されているはず、ただし後処理が終わってないのでabortはまだ完了していない
    await flushPromises();
    expect(taskSignal?.aborted).toBe(true);
    expect(abortDone).toBe(false);

    // 後処理を終了させる
    cleanup.resolve();
    await abort;
    expect(abortDone).toBe(true);
  });
});
