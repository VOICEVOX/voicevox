/**
 * 乱数値を生成する。モックに対応している。
 * モックモードでは呼ばれた回数に応じて固定の値を返す。
 */

let mockMode = false;
let mockCount = 0;

/**
 * モックモードにし、呼ばれた回数をリセットする。
 */
export function resetMockMode(): void {
  mockMode = true;
  mockCount = 0;
}

/**
 * v4 UUID を生成する。
 */
export function uuid4(): string {
  if (!mockMode) {
    return crypto.randomUUID();
  } else {
    mockCount++;
    return `00000000-0000-4000-0000-${mockCount.toString().padStart(12, "0")}`;
  }
}
