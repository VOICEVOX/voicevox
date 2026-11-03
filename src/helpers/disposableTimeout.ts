/**
 * using文（Explicit Resource Management）で使えるsetTimeoutのラッパー。
 * usingのスコープを抜けると自動的にclearTimeoutされる。
 */
export class DisposableTimeout {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(ms: number, callback: () => void) {
    this.timer = setTimeout(callback, ms);
  }

  clear() {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  [Symbol.dispose]() {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
