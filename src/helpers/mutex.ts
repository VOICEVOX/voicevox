import AsyncLock, { AsyncLockOptions } from "async-lock";

const key = "lock";
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
  constructor(
    private release: () => void,
    private ensureUnlocked: Promise<void>,
  ) {}
  async [Symbol.asyncDispose]() {
    this.release();
    await this.ensureUnlocked;
  }
}
