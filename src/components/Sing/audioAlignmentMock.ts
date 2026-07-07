import type { Tempo, TimeSignature } from "@/domain/project/type";

export const MOCK_AUDIO_TRACK_ID = "mock-audio-track";
export const MOCK_AUDIO_CLIP_ID = "mock-audio-clip-main";
export const MOCK_AUDIO_CLIP_BASE_LEFT_PERCENT = 10;
export const MOCK_AUDIO_CLIP_WIDTH_PERCENT = 52;
export const MOCK_AUDIO_PEAKS = [
  34, 56, 48, 71, 42, 62, 76, 54, 39, 68, 82, 57, 44, 73, 51, 64, 35, 59, 78,
  46, 69, 53, 41, 66,
];

export type AudioAlignmentMockState = {
  selectedClipId?: string;
  coarseMeasureOffset: number;
  fineOffsetMs: number;
  snapToGrid: boolean;
};

export const createDefaultAudioAlignmentMockState =
  (): AudioAlignmentMockState => ({
    selectedClipId: undefined,
    coarseMeasureOffset: 0,
    fineOffsetMs: 234,
    snapToGrid: false,
  });

export const getAudioAlignmentMeasureDurationMs = ({
  tempos,
  timeSignatures,
}: {
  tempos: readonly Tempo[];
  timeSignatures: readonly TimeSignature[];
}) => {
  const bpm = tempos[0]?.bpm ?? 120;
  const timeSignature = timeSignatures[0];
  const beats = timeSignature?.beats ?? 4;
  const beatType = timeSignature?.beatType ?? 4;
  return (60_000 / bpm) * beats * (4 / beatType);
};

export const getAudioAlignmentOffsetMs = (
  state: AudioAlignmentMockState,
  measureDurationMs: number,
) =>
  Math.round(
    state.coarseMeasureOffset * measureDurationMs + state.fineOffsetMs,
  );

export const splitAudioAlignmentOffsetMs = (
  offsetMs: number,
  measureDurationMs: number,
) => {
  const safeMeasureDurationMs = Math.max(measureDurationMs, 1);
  const coarseMeasureOffset = Math.trunc(offsetMs / safeMeasureDurationMs);
  return {
    coarseMeasureOffset,
    fineOffsetMs: Math.round(
      offsetMs - coarseMeasureOffset * safeMeasureDurationMs,
    ),
  };
};

export const formatAudioAlignmentOffsetMs = (offsetMs: number) => {
  const sign = offsetMs > 0 ? "+" : "";
  return `${sign}${offsetMs.toLocaleString()} ms`;
};
