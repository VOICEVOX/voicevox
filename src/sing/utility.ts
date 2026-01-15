import { UnreachableError } from "@/type/utility";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * 二次元ベクトルを表現するクラス。
 */
export class Vector2D {
  readonly x: number;
  readonly y: number;

  private cache: {
    magnitude: number | undefined;
  };

  /**
   * 自分自身のベクトルの大きさ（L2ノルム）。
   */
  get magnitude() {
    if (this.cache.magnitude == undefined) {
      this.cache.magnitude = Math.sqrt(this.x * this.x + this.y * this.y);
    }
    return this.cache.magnitude;
  }

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;

    this.cache = {
      magnitude: undefined,
    };
  }

  /**
   * スカラー倍: スカラー値との積を返す。
   */
  scale(scalar: number) {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  /**
   * 単位ベクトルを返す。
   */
  toUnitVector() {
    if (this.magnitude === 0) {
      throw new Error("Cannot convert to unit vector: magnitude is zero.");
    }
    return new Vector2D(this.x / this.magnitude, this.y / this.magnitude);
  }
}

/**
 * 矩形から点への最小距離ベクトルを計算する。
 */
export function calcMinimumDistanceVectorRectAndPoint(
  rect: Rect,
  point: Vector2D,
) {
  let distanceX = 0;
  if (point.x < rect.x) {
    distanceX = point.x - rect.x;
  } else if (point.x > rect.x + rect.width) {
    distanceX = point.x - (rect.x + rect.width);
  }

  let distanceY = 0;
  if (point.y < rect.y) {
    distanceY = point.y - rect.y;
  } else if (point.y > rect.y + rect.height) {
    distanceY = point.y - (rect.y + rect.height);
  }

  return new Vector2D(distanceX, distanceY);
}

export function round(value: number, digits: number) {
  const powerOf10 = 10 ** digits;
  return Math.round(value * powerOf10) / powerOf10;
}

export function clamp(value: number, min: number, max: number) {
  if (min > max) {
    throw new Error(
      `Invalid range: min (${min}) cannot be greater than max (${max}).`,
    );
  }
  return Math.min(max, Math.max(min, value));
}

export function getLast<T>(array: T[]) {
  if (array.length === 0) {
    throw new Error("array.length is 0.");
  }
  return array[array.length - 1];
}

export function getPrev<T>(array: T[], currentIndex: number) {
  return currentIndex !== 0 ? array[currentIndex - 1] : undefined;
}

export function getNext<T>(array: T[], currentIndex: number) {
  return currentIndex !== array.length - 1
    ? array[currentIndex + 1]
    : undefined;
}

export function isSorted<T>(array: T[], compareFn: (a: T, b: T) => number) {
  for (let i = 0; i < array.length - 1; i++) {
    if (compareFn(array[i], array[i + 1]) > 0) {
      return false;
    }
  }
  return true;
}

export function createArray<T>(
  length: number,
  generateElementFn: (index: number) => T,
) {
  return Array.from({ length }, (_, i) => generateElementFn(i));
}

export const recordToMap = <K extends string, V>(record: Record<K, V>) => {
  const keys = Object.keys(record) as K[];
  const entries = keys.map((key) => {
    const value = record[key];
    if (value == undefined) {
      throw new UnreachableError("value is undefined.");
    }
    return [key, value] as const;
  });
  return new Map(entries);
};

export const mapToRecord = <K extends string, V>(map: Map<K, V>) => {
  return Object.fromEntries(map) as Record<K, V>;
};

export function linearInterpolation(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
) {
  if (x2 <= x1) {
    throw new Error("x2 must be greater than x1.");
  }
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

function createGaussianKernel(sigma: number) {
  if (sigma <= 0) {
    throw new Error("sigma must be greater than 0.");
  }
  const kernelSize = Math.ceil(sigma * 2.5) * 2 + 1;
  const center = Math.floor(kernelSize / 2);

  let kernel: number[] = [];
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = Math.abs(center - i);
    const value = Math.exp(-(x ** 2) / (2 * sigma ** 2));
    kernel.push(value);
    sum += value;
  }
  kernel = kernel.map((value) => value / sum);
  return kernel;
}

export function applyGaussianFilter(data: number[], sigma: number) {
  const kernel = createGaussianKernel(sigma);
  const center = Math.floor(kernel.length / 2);
  const clonedData = [...data];

  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < kernel.length; j++) {
      let indexToRead = i - center + j;
      indexToRead = Math.max(0, indexToRead);
      indexToRead = Math.min(data.length - 1, indexToRead);
      sum += clonedData[indexToRead] * kernel[j];
    }
    data[i] = sum;
  }
}

/**
 * Smoothstep補間関数。0から1へ滑らかに遷移するS字カーブを生成する。
 *
 * @param x - 補間位置（0〜1）
 * @returns 補間された値（0〜1）
 */
function smoothStep(x: number) {
  const clampedX = Math.min(1.0, Math.max(0.0, x));
  return clampedX * clampedX * (3.0 - 2.0 * clampedX);
}

/**
 * 配列内の複数の不連続箇所（ジャンプ）を、滑らかな遷移でつなぐ。
 *
 * この関数は `data` 配列を破壊的に変更する。
 * ジャンプは `data[jumpIndex - 1]` と `data[jumpIndex]` の間に存在し、
 * その中心を基準に左右へsmoothstep関数で重み付けされた遷移が適用される。
 * 遷移長は配列の境界や隣接ジャンプまでの距離により自動的に制限される。
 * 複数のジャンプは順次処理され、遷移範囲が重複する場合は両方の遷移が適用される。
 *
 * @param data - 対象のデータ配列
 * @param jumpIndices - ジャンプのインデックスの配列
 * @param transitionConstraints - 各ジャンプの左右の遷移長の制約。配列の場合は各ジャンプごとに異なる遷移長を指定できる。
 */
export function applySmoothTransitions(
  data: number[],
  jumpIndices: number[],
  transitionConstraints:
    | { left: number; right: number }
    | { left: number; right: number }[],
) {
  const transitionConstraintArray = Array.isArray(transitionConstraints)
    ? transitionConstraints
    : createArray(jumpIndices.length, () => transitionConstraints);
  if (jumpIndices.some((value) => !Number.isInteger(value))) {
    throw new Error("jumpIndices must contain integers.");
  }
  if (!isSorted(jumpIndices, (a, b) => a - b)) {
    throw new Error("jumpIndices must be sorted in ascending order.");
  }
  for (let i = 1; i < jumpIndices.length; i++) {
    if (jumpIndices[i] === jumpIndices[i - 1]) {
      throw new Error("jumpIndices must not contain duplicate values.");
    }
  }
  if (jumpIndices.length !== 0) {
    if (jumpIndices[0] <= 0 || getLast(jumpIndices) >= data.length) {
      throw new Error("jumpIndex must satisfy 0 < jumpIndex < data.length.");
    }
  }
  if (transitionConstraintArray.length !== jumpIndices.length) {
    throw new Error(
      "transitionConstraints must have the same length as jumpIndices.",
    );
  }
  for (let i = 0; i < transitionConstraintArray.length; i++) {
    const { left, right } = transitionConstraintArray[i];

    if (!Number.isInteger(left) || !Number.isInteger(right)) {
      throw new Error("transitionConstraints must contain only integers.");
    }
    if (left < 0 || right < 0) {
      throw new Error("transitionConstraints must be non-negative.");
    }
    if (left === 0 && right === 0) {
      throw new Error("transitionConstraints must not be both zero.");
    }
  }

  // 各ジャンプに対して遷移を適用
  for (let i = 0; i < jumpIndices.length; i++) {
    const jumpIndex = jumpIndices[i];
    const jumpSize = data[jumpIndex] - data[jumpIndex - 1];

    // ジャンプサイズが0の場合は処理をスキップ
    if (jumpSize === 0) {
      continue;
    }

    // 利用可能なスペースを計算
    const leftSpace = i === 0 ? jumpIndex : jumpIndex - jumpIndices[i - 1];
    const rightSpace =
      i === jumpIndices.length - 1
        ? data.length - jumpIndex
        : jumpIndices[i + 1] - jumpIndex;

    // 遷移長を利用可能なスペースに制限
    const leftTransitionLength = Math.min(
      leftSpace,
      transitionConstraintArray[i].left,
    );
    const rightTransitionLength = Math.min(
      rightSpace,
      transitionConstraintArray[i].right,
    );

    // 遷移範囲を計算（ジャンプの中心を基準に左右に広がる）
    const jumpCenter = jumpIndex - 0.5;
    const transitionStart = jumpCenter - leftTransitionLength;
    const transitionEnd = jumpCenter + rightTransitionLength;
    const totalTransitionLength = leftTransitionLength + rightTransitionLength;

    // 整数インデックス範囲に変換（配列境界内にクリップ）
    const startIndex = Math.max(0, Math.ceil(transitionStart));
    const endIndex = Math.min(data.length, Math.floor(transitionEnd) + 1);

    // smoothStepで重み付けした遷移を適用
    for (let j = startIndex; j < endIndex; j++) {
      const normalizedPosition = (j - transitionStart) / totalTransitionLength;
      const weight = smoothStep(normalizedPosition);

      if (j < jumpCenter) {
        data[j] += jumpSize * weight;
      } else {
        data[j] -= jumpSize * (1 - weight);
      }
    }
  }
}

export async function calculateHash<T>(obj: T) {
  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(JSON.stringify(obj));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

export function createPromiseThatResolvesWhen(
  condition: () => boolean,
  interval = 200,
) {
  return new Promise<void>((resolve) => {
    const checkCondition = () => {
      if (condition()) {
        resolve();
      }
      window.setTimeout(checkCondition, interval);
    };
    checkCondition();
  });
}

/**
 * タイマーです。関数を定期的に実行します。
 */
export class Timer {
  private readonly interval: number;
  private timeoutId?: number;

  get isStarted() {
    return this.timeoutId != undefined;
  }

  /**
   * @param interval 関数を実行する間隔（ミリ秒）
   */
  constructor(interval: number) {
    this.interval = interval;
  }

  start(onTick: () => void) {
    const callback = () => {
      onTick();
      this.timeoutId = window.setTimeout(callback, this.interval);
    };
    this.timeoutId = window.setTimeout(callback, this.interval);
  }

  stop() {
    if (this.timeoutId == undefined) {
      throw new Error("The timer is not started.");
    }
    window.clearTimeout(this.timeoutId);
    this.timeoutId = undefined;
  }
}

/**
 * requestAnimationFrameを使用して関数を定期的に実行します。
 * 関数は、指定された最大フレームレート以下で実行されます。
 */
export class AnimationTimer {
  private readonly maxFrameTime: number;
  private readonly maxDiff: number;

  private requestId?: number;
  private prevTimeStamp?: number;
  private diff = 0;

  get isStarted() {
    return this.requestId != undefined;
  }

  /**
   * @param maxFrameRate 最大フレームレート（フレーム毎秒）
   */
  constructor(maxFrameRate = 60) {
    this.maxFrameTime = 1000 / maxFrameRate;
    this.maxDiff = this.maxFrameTime * 10;
  }

  start(onAnimationFrame: () => void) {
    if (this.requestId != undefined) {
      throw new Error("The animation frame runner is already started.");
    }

    this.diff = 0;
    this.prevTimeStamp = undefined;

    const callback = (timeStamp: number) => {
      if (this.prevTimeStamp == undefined) {
        this.diff += this.maxFrameTime;
      } else {
        this.diff += timeStamp - this.prevTimeStamp;
      }
      this.diff = Math.min(this.maxDiff, this.diff);
      if (this.diff >= this.maxFrameTime) {
        this.diff -= this.maxFrameTime;
        onAnimationFrame();
      }
      this.prevTimeStamp = timeStamp;
      this.requestId = window.requestAnimationFrame(callback);
    };
    this.requestId = window.requestAnimationFrame(callback);
  }

  stop() {
    if (this.requestId == undefined) {
      throw new Error("The animation frame runner is not started.");
    }
    window.cancelAnimationFrame(this.requestId);
    this.requestId = undefined;
  }
}
