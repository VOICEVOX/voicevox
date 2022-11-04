function getPitchFromMidi(midi: number): string {
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

function getOctaveFromMidi(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

function getKeyColorFromMidi(midi: number): string {
  const mapWhiteKeys: Array<string> = ["C", "D", "E", "F", "G", "A", "B"];
  const pitch = getPitchFromMidi(midi);
  return mapWhiteKeys.includes(pitch) ? "white" : "black";
}

export const midiNotes = [...Array(128)].map((_, midi) => {
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
});

export function getDisplayNote(midi: number): object {
  return midiNotes[midi];
}
