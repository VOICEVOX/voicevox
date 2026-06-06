import AsyncLock, { type AsyncLockOptions } from "async-lock";

const key = "lock";

/**
 * Mutex。
 * `await using _lock = await mutex.acquire()`のように使用する。
 *
 * @example
 * ```ts
 * const mutex = new Mutex();
 * {
 *   await using lock = await mutex.acquire();
 *   // ロック中
 * }
 * // ロック外
 * ```
 */
export class Mutex {
  private lock: AsyncLock;

  constructor(options: AsyncLockOptions = {}) {
    this.lock = new AsyncLock(options);
  }

  acquire(): Promise<MutexLock> {
    const {
      promise: outerPromise,
      resolve: outerResolve,
      reject: outerReject,
    } = Promise.withResolvers<MutexLock>();
    const { promise: ensurePromise, resolve: ensureResolve } =
      Promise.withResolvers<void>();
    void this.lock
      .acquire(key, async () => {
        const { promise: innerPromise, resolve: innerResolve } =
          Promise.withResolvers<void>();
        const mutexLock = new MutexLock(innerResolve, ensurePromise);
        outerResolve(mutexLock);
        await innerPromise;
      })
      .then(
        () => {
          ensureResolve();
        },
        (err) => {
          outerReject(err);
        },
      );

    return outerPromise;
  }

  isLocked(): boolean {
    return this.lock.isBusy(key);
  }
}

class MutexLock {
  #release: () => void;
  #ensureUnlocked: Promise<void>;

  constructor(release: () => void, ensureUnlocked: Promise<void>) {
    this.#release = release;
    this.#ensureUnlocked = ensureUnlocked;
  }
  async release() {
    this.#release();
    await this.#ensureUnlocked;
  }

  [Symbol.asyncDispose]() {
    return this.release();
  }
}
