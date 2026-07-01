import { decibelToLinear, linearToDecibel } from "@/sing/audio";
import { clamp } from "@/sing/utility";

export type VolumeGridLine = {
  db: number;
  kind: "major" | "baseline";
  label: string;
  drawLine: boolean;
};

export type VolumeValueScale = {
  minDb: number;
  maxDb: number;
  gridLines: readonly VolumeGridLine[];
  normalizedYToDb: (normalizedY: number) => number;
  dbToNormalizedY: (db: number) => number;
  dbToValue: (input: {
    db: number;
    frame: number;
    originalValue: number | undefined;
  }) => number;
  valueToNormalizedY: (input: {
    value: number;
    frame: number;
    originalValue: number | undefined;
  }) => number;
};

export const ABSOLUTE_VOLUME_MIN_DB = -36.5;
export const ABSOLUTE_VOLUME_MAX_DB = -0.5;

export const ABSOLUTE_VOLUME_GRID_LINES = [
  { db: ABSOLUTE_VOLUME_MAX_DB, kind: "baseline", label: "0", drawLine: false },
  { db: -6, kind: "major", label: "-6", drawLine: true },
  { db: -12, kind: "major", label: "-12", drawLine: true },
  { db: -18, kind: "major", label: "-18", drawLine: true },
  { db: -24, kind: "major", label: "-24", drawLine: true },
  { db: -30, kind: "major", label: "-30", drawLine: true },
  { db: -36, kind: "major", label: "-36", drawLine: false },
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

const dbToValue = ({ db }: Parameters<VolumeValueScale["dbToValue"]>[0]) => {
  assertFinite(db, "db");
  return Math.min(decibelToLinear(db), 1);
};

const valueToNormalizedY = ({
  value,
}: Parameters<VolumeValueScale["valueToNormalizedY"]>[0]) => {
  assertFinite(value, "value");
  if (value < 0) {
    throw new Error("value must be greater than or equal to 0.");
  }

  return dbToNormalizedY(linearToDecibel(Math.min(value, 1)));
};

export const absoluteVolumeValueScale: VolumeValueScale = {
  minDb: ABSOLUTE_VOLUME_MIN_DB,
  maxDb: ABSOLUTE_VOLUME_MAX_DB,
  gridLines: ABSOLUTE_VOLUME_GRID_LINES,
  normalizedYToDb,
  dbToNormalizedY,
  dbToValue,
  valueToNormalizedY,
};
