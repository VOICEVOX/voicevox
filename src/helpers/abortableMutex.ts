import { Mutex } from "./mutex";

/**
 * 新しい処理を要求すると、前の処理を中断するMutex。
 * コールバックの終了を待ってから次の処理を実行する。
 *
 * @example
 * ```ts
 * const mutex = new AbortableMutex();
 * await mutex.lock(async (signal) => {
 *   if (signal.aborted) return;
 *   await fetch(url, { signal });
 * });
 * ```
 */
export class AbortableMutex {
  private mutex = new Mutex();
  private controller: AbortController | undefined;

  /**
   * 前の処理を中断し、ロック取得後にcallbackを実行する。
   *
   * callbackはsignalに従って処理を中断すること。
   */
  async lock<T>(callback: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    await using _lock = await this.mutex.acquire();
    try {
      return await callback(controller.signal);
    } finally {
      if (this.controller === controller) {
        this.controller = undefined;
      }
    }
  }

  /**
   * 現在の要求を中断し、呼び出し時点で登録済みの処理の終了を待つ。
   * 停止中や連続して呼び出しても問題ない。
   */
  async abort(): Promise<void> {
    this.controller?.abort();
    await using _lock = await this.mutex.acquire();
  }
}
