import { linearToDecibel } from "@/sing/audio";
import { clamp, round } from "@/sing/utility";

/** dB軸の目盛り。ラベルと、その高さでボリューム編集レーンを横切る水平線を定義する。 */
export type DbGridLine = {
  db: number;
  /** TODO: 後続PRの相対編集化で0dB基準線を描き分けるため、baselineを独立した種別として先に定義する。 */
  kind: "major" | "minor" | "baseline";
  label: string;
  /** 水平線を引かず、左dB軸の目盛りラベルだけを表示する。省略時は水平線も表示する。 */
  labelOnly?: true;
};

export type VolumeValueScale = {
  minDb: number;
  maxDb: number;
  gridLines: readonly DbGridLine[];
  normalizedYToDb: (normalizedY: number) => number;
  dbToNormalizedY: (db: number) => number;
  valueToDb: (value: number) => number;
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

// 定規と同じ3段構成: baseline=表示上の0、major=主目盛り、minor=補助目盛り。
// レーンが低いときはminorの線とラベルを省き、さらに低いときはラベルをすべて省く。
// 上下端付近はレーン境界と重なって見えるため、labelOnlyでラベルだけ表示する。
export const ABSOLUTE_VOLUME_GRID_LINES = [
  {
    db: ABSOLUTE_VOLUME_MAX_DB,
    kind: "baseline",
    label: "0",
    labelOnly: true,
  },
  {
    db: -6,
    kind: "minor",
    label: "-6",
  },
  {
    db: -12,
    kind: "major",
    label: "-12",
  },
  {
    db: -18,
    kind: "minor",
    label: "-18",
  },
  {
    db: -24,
    kind: "major",
    label: "-24",
  },
  {
    db: -30,
    kind: "minor",
    label: "-30",
  },
  {
    db: -36,
    kind: "major",
    label: "-36",
    labelOnly: true,
  },
] as const satisfies readonly DbGridLine[];

const normalizedYToDb = (normalizedY: number) => {
  if (!Number.isFinite(normalizedY)) {
    throw new Error("normalizedY must be finite.");
  }
  const clampedY = clamp(normalizedY, 0, 1);
  return (
    ABSOLUTE_VOLUME_MIN_DB +
    clampedY * (ABSOLUTE_VOLUME_MAX_DB - ABSOLUTE_VOLUME_MIN_DB)
  );
};

const dbToNormalizedY = (db: number) => {
  if (!Number.isFinite(db)) {
    throw new Error("db must be finite.");
  }
  const clampedDb = clamp(db, ABSOLUTE_VOLUME_MIN_DB, ABSOLUTE_VOLUME_MAX_DB);
  return (
    (clampedDb - ABSOLUTE_VOLUME_MIN_DB) /
    (ABSOLUTE_VOLUME_MAX_DB - ABSOLUTE_VOLUME_MIN_DB)
  );
};

const valueToDb = (value: number) => {
  if (!Number.isFinite(value)) {
    throw new Error("value must be finite.");
  }
  if (value < 0) {
    throw new Error("value must be greater than or equal to 0.");
  }

  return linearToDecibel(value);
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
  valueToDb,
  formatDbLabel,
};
