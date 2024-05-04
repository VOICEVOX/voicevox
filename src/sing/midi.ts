import {
  MidiData,
  parseMidi,
  MidiTrackNameEvent,
  MidiEvent,
  MidiSetTempoEvent,
  MidiTimeSignatureEvent,
  MidiLyricsEvent,
  MidiNoteOnEvent,
  MidiNoteOffEvent,
} from "midi-file";
type Tempo = { ticks: number; bpm: number };
type TimeSignature = {
  ticks: number;
  numerator: number;
  denominator: number;
};
type Note = {
  ticks: number;
  noteNumber: number;
  duration: number;
  lyric?: string;
};

// BPMの精度。（小数点以下の桁数）
const bpmPrecision = 2;

/**
 * midi-fileの軽いラッパー。
 */
export class Midi {
  data: MidiData;
  tracks: Track[];
  constructor(data: ArrayBuffer) {
    this.data = parseMidi(new Uint8Array(data));
    this.tracks = this.data.tracks.map((track) => new Track(track));
  }

  get header() {
    return this.data.header;
  }

  get ticksPerBeat() {
    const maybeTicksPerBeat = this.data.header.ticksPerBeat;
    if (maybeTicksPerBeat == undefined) {
      throw new Error("ticksPerBeat is undefined");
    }
    return maybeTicksPerBeat;
  }

  get tempos(): Tempo[] {
    const tempos = this.tracks.flatMap((track) => track.tempos);
    tempos.sort((a, b) => a.ticks - b.ticks);
    return tempos;
  }

  get timeSignatures(): TimeSignature[] {
    const timeSignatures = this.tracks.flatMap((track) => track.timeSignatures);
    timeSignatures.sort((a, b) => a.ticks - b.ticks);
    return timeSignatures;
  }
}

type MidiEventWithTime<T extends MidiEvent = MidiEvent> = {
  time: number;
} & T;
export class Track {
  readonly data: MidiData["tracks"][0];
  readonly events: MidiEventWithTime[];
  readonly notes: Note[];
  constructor(data: MidiData["tracks"][0]) {
    this.data = data;
    let time = 0;
    this.events = data.map((event) => {
      time += event.deltaTime;
      return { time, ...event };
    });
    const lyrics = this.events.filter(
      (e) => e.type === "lyrics",
    ) as MidiEventWithTime<MidiLyricsEvent>[];
    const lyricsMap = new Map<number, string>(
      lyrics.map((e) => {
        // midi-fileはUTF-8としてデコードしてくれないので、ここでデコードする
        const buffer = new Uint8Array(
          e.text.split("").map((c) => c.charCodeAt(0)),
        );
        const decoder = new TextDecoder("utf-8");
        return [e.time, decoder.decode(buffer)];
      }),
    );

    const noteOnOffs = this.events.filter(
      (e) => e.type === "noteOn" || e.type === "noteOff",
    ) as MidiEventWithTime<MidiNoteOnEvent | MidiNoteOffEvent>[];
    noteOnOffs.sort((a, b) => a.time - b.time);
    this.notes = [];
    const temporaryNotes = new Map<
      number,
      { noteNumber: number; time: number }
    >();
    for (const event of noteOnOffs) {
      if (event.type === "noteOn") {
        if (temporaryNotes.has(event.noteNumber)) {
          throw new Error("noteOn without noteOff");
        }
        temporaryNotes.set(event.noteNumber, {
          noteNumber: event.noteNumber,
          time: event.time,
        });
      } else {
        const note = temporaryNotes.get(event.noteNumber);
        if (!note) {
          throw new Error("noteOff without noteOn");
        }
        temporaryNotes.delete(event.noteNumber);
        this.notes.push({
          ticks: note.time,
          noteNumber: note.noteNumber,
          duration: event.time - note.time,
          // 同じタイミングの歌詞をノートの歌詞として使う
          lyric: lyricsMap.get(note.time),
        });
      }
    }
  }

  get name() {
    const nameEvent = this.data.find(
      (e) => e.type === "trackName",
    ) as MidiTrackNameEvent;
    if (!nameEvent) {
      return "";
    }
    return nameEvent.text;
  }

  get tempos(): Tempo[] {
    const tempoEvents = this.events.filter(
      (e) => e.type === "setTempo",
    ) as MidiEventWithTime<MidiSetTempoEvent>[];

    const tempos = tempoEvents.map((e) => ({
      ticks: e.time,
      bpm:
        Math.round(
          ((60 * 1000000) / e.microsecondsPerBeat) * 10 ** bpmPrecision,
        ) /
        10 ** bpmPrecision,
    }));
    tempos.sort((a, b) => a.ticks - b.ticks);
    return tempos;
  }

  get timeSignatures(): TimeSignature[] {
    const timeSignatureEvents = this.events.filter(
      (e) => e.type === "timeSignature",
    ) as MidiEventWithTime<MidiTimeSignatureEvent>[];

    const timeSignatures = timeSignatureEvents.map((e) => ({
      ticks: e.time,
      numerator: e.numerator,
      denominator: e.denominator,
    }));
    timeSignatures.sort((a, b) => a.ticks - b.ticks);
    return timeSignatures;
  }
}
