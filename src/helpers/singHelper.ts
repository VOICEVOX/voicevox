export function getPitchFromMidi(midi: number): string {
  const mapPitches: Array<string> = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const pitchPos = midi % 12;
  return mapPitches[pitchPos];
}

export function getDoremiFromMidi(midi: number): string {
  const mapPitches: Array<string> = [
    "ド",
    "ド",
    "レ",
    "レ",
    "ミ",
    "ファ",
    "ファ",
    "ソ",
    "ソ",
    "ラ",
    "ラ",
    "ラ",
  ];
  const pitchPos = midi % 12;
  return mapPitches[pitchPos];
}

export function getOctaveFromMidi(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

export function getKeyColorFromMidi(midi: number): string {
  const mapWhiteKeys: Array<string> = ["C", "D", "E", "F", "G", "A", "B"];
  const pitch = getPitchFromMidi(midi);
  return mapWhiteKeys.includes(pitch) ? "white" : "black";
}

export const midiKeys = [...Array(128)]
  .map((_, midi) => {
    const pitch = getPitchFromMidi(midi);
    const octave = getOctaveFromMidi(midi);
    const name = `${pitch}${octave}`;
    const color = getKeyColorFromMidi(midi);
    return {
      midi,
      pitch,
      octave,
      name,
      color,
    };
  })
  .reverse();

export function getDisplayKey(midi: number): object {
  return midiKeys[midi];
}
