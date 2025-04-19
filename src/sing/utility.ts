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

function ceilToOdd(value: number) {
  return 1 + Math.ceil((value - 1) / 2) * 2;
}

function createGaussianKernel(sigma: number) {
  const kernelSize = ceilToOdd(sigma * 3);
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
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < kernel.length; j++) {
      let indexToRead = i - center + j;
      indexToRead = Math.max(0, indexToRead);
      indexToRead = Math.min(data.length - 1, indexToRead);
      sum += data[indexToRead] * kernel[j];
    }
    data[i] = sum;
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
