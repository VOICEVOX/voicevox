/**
 * 乱数値を生成する。モックに対応している。
 * モックモードでは呼ばれた回数に応じて固定の値を返す。
 */

let mockMode = false;
let uuid4MockCount = 0;
let randomInt32MockCount = 0;

/**
 * モックモードにし、呼ばれた回数をリセットする。
 */
export function resetMockMode(): void {
  mockMode = true;
  uuid4MockCount = 0;
  randomInt32MockCount = 0;
}

/**
 * v4 UUID を生成する。
 */
export function uuid4(): string {
  if (!mockMode) {
    return crypto.randomUUID();
  } else {
    uuid4MockCount++;
    return `00000000-0000-4000-0000-${uuid4MockCount.toString().padStart(12, "0")}`;
  }
}

/**
 * 符号付き32bit整数の乱数を生成する。
 */
export function randomInt32(): number {
  if (!mockMode) {
    return crypto.getRandomValues(new Int32Array(1))[0];
  } else {
    randomInt32MockCount++;
    return randomInt32MockCount;
  }
}
