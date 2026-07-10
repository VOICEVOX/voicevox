import { linearToDecibel } from "@/sing/audio";
import { clamp, round } from "@/sing/utility";

export type VolumeGridLine = {
  db: number;
  kind: "major" | "baseline";
  label: string;
  drawLine: boolean;
  displayPriority: "primary" | "secondary";
};

export type VolumeValueScale = {
  minDb: number;
  maxDb: number;
  gridLines: readonly VolumeGridLine[];
  normalizedYToDb: (normalizedY: number) => number;
  dbToNormalizedY: (db: number) => number;
  valueToNormalizedY: (value: number) => number;
  /** ツールチップなどに表示するdB値を整形する */
  formatDbLabel: (db: number) => string;
};

// NOTE: 最大値・最小値はエンジン出力と表示に合わせたヒューリスティックなもの。
// エディタ側の表示や編集の問題ではないためエンジンが変わったら変更可能だが、既存のプロジェクトで表示が変わる点には注意。
// 最大値: 0dB相当でのエンジン出力品質があまりよくなさそうなため、-0.5dB相当に設定。
// 最小値: -36dB程度以下はエンジンの出力がノイズっぽいのと、オリジナルボリューム（エンジン出力デフォルト）の典型的な範囲で見やすい程度の高さにするため。
// 上端は内部的には-0.5dBだが、UIでは実用上の最大値を0dBと表記する。
export const ABSOLUTE_VOLUME_MIN_DB = -36.5;
export const ABSOLUTE_VOLUME_MAX_DB = -0.5;

// レーンが低い場合はprimaryだけを表示し、12dB間隔に間引く。
// 上下端はビューポートの縁と重なって見えるため、ラベルだけを表示して線は引かない。
export const ABSOLUTE_VOLUME_GRID_LINES = [
  {
    db: ABSOLUTE_VOLUME_MAX_DB,
    kind: "baseline",
    label: "0",
    drawLine: false,
    displayPriority: "primary",
  },
  {
    db: -6,
    kind: "major",
    label: "-6",
    drawLine: true,
    displayPriority: "secondary",
  },
  {
    db: -12,
    kind: "major",
    label: "-12",
    drawLine: true,
    displayPriority: "primary",
  },
  {
    db: -18,
    kind: "major",
    label: "-18",
    drawLine: true,
    displayPriority: "secondary",
  },
  {
    db: -24,
    kind: "major",
    label: "-24",
    drawLine: true,
    displayPriority: "primary",
  },
  {
    db: -30,
    kind: "major",
    label: "-30",
    drawLine: true,
    displayPriority: "secondary",
  },
  {
    db: -36,
    kind: "major",
    label: "-36",
    drawLine: false,
    displayPriority: "primary",
  },
] as const satisfies readonly VolumeGridLine[];

const assertFinite = (value: number, name: string) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite.`);
  }
};

const normalizedYToDb = (normalizedY: number) => {
  assertFinite(normalizedY, "normalizedY");
  const clampedY = clamp(normalizedY, 0, 1);
  return (
    ABSOLUTE_VOLUME_MIN_DB +
    clampedY * (ABSOLUTE_VOLUME_MAX_DB - ABSOLUTE_VOLUME_MIN_DB)
  );
};

const dbToNormalizedY = (db: number) => {
  assertFinite(db, "db");
  const clampedDb = clamp(db, ABSOLUTE_VOLUME_MIN_DB, ABSOLUTE_VOLUME_MAX_DB);
  return (
    (clampedDb - ABSOLUTE_VOLUME_MIN_DB) /
    (ABSOLUTE_VOLUME_MAX_DB - ABSOLUTE_VOLUME_MIN_DB)
  );
};

const valueToNormalizedY = (value: number) => {
  assertFinite(value, "value");
  if (value < 0) {
    throw new Error("value must be greater than or equal to 0.");
  }

  // 絶対値編集の表示上限は0dB相当なので、1を超える値は上端に飽和させる。
  return dbToNormalizedY(linearToDecibel(Math.min(value, 1)));
};

const formatDbLabel = (db: number) => {
  // スケール上端はグリッドラベルと同じ「0」表記に揃える
  const roundedDb = db >= ABSOLUTE_VOLUME_MAX_DB ? 0 : round(db, 1);
  return roundedDb.toFixed(1);
};

export const absoluteVolumeValueScale: VolumeValueScale = {
  minDb: ABSOLUTE_VOLUME_MIN_DB,
  maxDb: ABSOLUTE_VOLUME_MAX_DB,
  gridLines: ABSOLUTE_VOLUME_GRID_LINES,
  normalizedYToDb,
  dbToNormalizedY,
  valueToNormalizedY,
  formatDbLabel,
};
