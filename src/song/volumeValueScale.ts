import { clamp, round } from "@/song/utility";

export type VolumeValueScale = {
  minDb: number;
  maxDb: number;
  normalizedYToDb: (normalizedY: number) => number;
  dbToNormalizedY: (db: number) => number;
  /** ツールチップなどに表示するdB値を整形する */
  formatDbLabel: (db: number) => string;
};

// NOTE: 表示範囲はヒューリスティックなもの。
// 0dB（原音のまま）が中央に来るように上下対称とし、持ち上げすぎ・下げすぎで破綻しない±12dBに設定。
export const RELATIVE_VOLUME_MIN_DB = -12;
export const RELATIVE_VOLUME_MAX_DB = 12;

const normalizedYToDb = (normalizedY: number) => {
  if (!Number.isFinite(normalizedY)) {
    throw new Error("normalizedY must be finite.");
  }
  const clampedY = clamp(normalizedY, 0, 1);
  return (
    RELATIVE_VOLUME_MIN_DB +
    clampedY * (RELATIVE_VOLUME_MAX_DB - RELATIVE_VOLUME_MIN_DB)
  );
};

const dbToNormalizedY = (db: number) => {
  if (!Number.isFinite(db)) {
    throw new Error("db must be finite.");
  }
  const clampedDb = clamp(db, RELATIVE_VOLUME_MIN_DB, RELATIVE_VOLUME_MAX_DB);
  return (
    (clampedDb - RELATIVE_VOLUME_MIN_DB) /
    (RELATIVE_VOLUME_MAX_DB - RELATIVE_VOLUME_MIN_DB)
  );
};

const formatDbLabel = (db: number) => {
  const roundedDb = round(db, 1);
  const text = roundedDb.toFixed(1);
  return roundedDb > 0 ? `+${text}` : text;
};

export const relativeVolumeValueScale: VolumeValueScale = {
  minDb: RELATIVE_VOLUME_MIN_DB,
  maxDb: RELATIVE_VOLUME_MAX_DB,
  normalizedYToDb,
  dbToNormalizedY,
  formatDbLabel,
};
