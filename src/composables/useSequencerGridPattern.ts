import { computed, Ref } from "vue";
import { tickToBaseX } from "@/sing/viewHelper";
import { TimeSignature } from "@/store/type";

const beatWidth = (
  timeSignature: TimeSignature,
  tpqn: number,
  sequencerZoomX: number,
) => {
  const beatType = timeSignature.beatType;
  const wholeNoteDuration = tpqn * 4;
  const beatTicks = wholeNoteDuration / beatType;
  return tickToBaseX(beatTicks, tpqn) * sequencerZoomX;
};

export const useSequencerGrid = ({
  timeSignatures,
  tpqn,
  sequencerZoomX,
  numMeasures,
}: {
  timeSignatures: Ref<TimeSignature[]>;
  tpqn: Ref<number>;
  sequencerZoomX: Ref<number>;
  numMeasures: Ref<number>;
}) =>
  computed(() => {
    const gridPatterns: {
      id: string;
      x: number;
      timeSignature: TimeSignature;
      beatWidth: number;
      beatsPerMeasure: number;
      patternWidth: number;
      width: number;
    }[] = [];
    for (const [i, timeSignature] of timeSignatures.value.entries()) {
      const maybeNextTimeSignature = timeSignatures.value.at(i + 1);
      const nextMeasureNumber =
        maybeNextTimeSignature?.measureNumber ?? numMeasures.value + 1;
      const patternWidth =
        beatWidth(timeSignature, tpqn.value, sequencerZoomX.value) *
        timeSignature.beats;
      gridPatterns.push({
        id: `sequencer-grid-pattern-${i}`,
        timeSignature,
        x:
          gridPatterns.length === 0
            ? 0
            : gridPatterns[gridPatterns.length - 1].x +
              gridPatterns[gridPatterns.length - 1].width,
        beatWidth: beatWidth(timeSignature, tpqn.value, sequencerZoomX.value),
        beatsPerMeasure: timeSignature.beats,
        patternWidth,
        width: patternWidth * (nextMeasureNumber - timeSignature.measureNumber),
      });
    }

    return gridPatterns;
  });
