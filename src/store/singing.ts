import path from "path";
import { Midi } from "@tonejs/midi";
import { v4 as uuidv4 } from "uuid";
import {
  Score,
  Tempo,
  TimeSignature,
  Note,
  SingingStoreState,
  SingingStoreTypes,
  SaveResultObject,
  Singer,
  Phrase,
  PhraseState,
} from "./type";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import {
  AudioEvent,
  AudioPlayer,
  AudioSequence,
  ChannelStrip,
  Clipper,
  Instrument,
  Limiter,
  NoteEvent,
  NoteSequence,
  OfflineTransport,
  PolySynth,
  Sequence,
  Transport,
} from "@/infrastructures/AudioRenderer";
import {
  BEAT_TYPES,
  DEFAULT_BEATS,
  DEFAULT_BEAT_TYPE,
  DEFAULT_BPM,
  DEFAULT_TPQN,
  getDoremiFromNoteNumber,
  getMeasureDuration,
  isValidSnapType,
  noteNumberToFrequency,
  round,
  FrequentlyUpdatedState,
  AnimationFrameRunner,
} from "@/helpers/singHelper";
import { AudioQuery, Mora } from "@/openapi";
import { ResultError, getValueOrThrow } from "@/type/result";

const tickToSecondForConstantBpm = (
  ticks: number,
  bpm: number,
  tpqn: number
) => {
  const quarterNotesPerMinute = bpm;
  const quarterNotesPerSecond = quarterNotesPerMinute / 60;
  return ticks / tpqn / quarterNotesPerSecond;
};

const secondToTickForConstantBpm = (
  seconds: number,
  bpm: number,
  tpqn: number
) => {
  const quarterNotesPerMinute = bpm;
  const quarterNotesPerSecond = quarterNotesPerMinute / 60;
  return seconds * quarterNotesPerSecond * tpqn;
};

const tickToSecond = (ticks: number, tempos: Tempo[], tpqn: number) => {
  let timeOfTempo = 0;
  let tempo = tempos[tempos.length - 1];
  for (let i = 0; i < tempos.length; i++) {
    if (i === tempos.length - 1) {
      break;
    }
    if (tempos[i + 1].position > ticks) {
      tempo = tempos[i];
      break;
    }
    timeOfTempo += tickToSecondForConstantBpm(
      tempos[i + 1].position - tempos[i].position,
      tempos[i].bpm,
      tpqn
    );
  }
  return (
    timeOfTempo +
    tickToSecondForConstantBpm(ticks - tempo.position, tempo.bpm, tpqn)
  );
};

const secondToTick = (seconds: number, tempos: Tempo[], tpqn: number) => {
  let timeOfTempo = 0;
  let tempo = tempos[tempos.length - 1];
  for (let i = 0; i < tempos.length; i++) {
    if (i === tempos.length - 1) {
      break;
    }
    const timeOfNextTempo =
      timeOfTempo +
      tickToSecondForConstantBpm(
        tempos[i + 1].position - tempos[i].position,
        tempos[i].bpm,
        tpqn
      );
    if (timeOfNextTempo > seconds) {
      tempo = tempos[i];
      break;
    }
    timeOfTempo = timeOfNextTempo;
  }
  return (
    tempo.position +
    secondToTickForConstantBpm(seconds - timeOfTempo, tempo.bpm, tpqn)
  );
};

const generateAudioEvents = async (
  audioContext: BaseAudioContext,
  time: number,
  blob: Blob
): Promise<AudioEvent[]> => {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(arrayBuffer);
  return [{ time, buffer }];
};

const generateNoteEvents = (notes: Note[], tempos: Tempo[], tpqn: number) => {
  return notes.map((value): NoteEvent => {
    const noteOnPos = value.position;
    const noteOffPos = value.position + value.duration;
    return {
      noteNumber: value.noteNumber,
      noteOnTime: tickToSecond(noteOnPos, tempos, tpqn),
      noteOffTime: tickToSecond(noteOffPos, tempos, tpqn),
    };
  });
};

const copyScore = (score: Score): Score => {
  return {
    tpqn: score.tpqn,
    tempos: score.tempos.map((value) => ({ ...value })),
    timeSignatures: score.timeSignatures.map((value) => ({ ...value })),
    notes: score.notes.map((value) => ({ ...value })),
  };
};

const copySinger = (singer?: Singer): Singer | undefined => {
  if (!singer) {
    return undefined;
  }
  return {
    engineId: singer.engineId,
    styleId: singer.styleId,
  };
};

const _generateHash = async <T>(obj: T) => {
  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(JSON.stringify(obj));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
};

const createPromiseThatResolvesWhen = (
  condition: () => boolean,
  interval = 200
) => {
  return new Promise<void>((resolve) => {
    const checkCondition = () => {
      if (condition()) {
        resolve();
      }
      window.setTimeout(checkCondition, interval);
    };
    checkCondition();
  });
};

const generateSingerAndScoreHash = async (obj: {
  singer: Singer | undefined;
  score: Score;
}) => {
  return _generateHash(obj);
};

const isValidTpqn = (tpqn: number) => {
  return (
    Number.isInteger(tpqn) &&
    BEAT_TYPES.every((value) => tpqn % value === 0) &&
    tpqn % 3 === 0
  );
};

const isValidTempo = (tempo: Tempo) => {
  return (
    Number.isInteger(tempo.position) &&
    Number.isFinite(tempo.bpm) &&
    tempo.position >= 0 &&
    tempo.bpm > 0
  );
};

const isValidBeatType = (beatType: number) => {
  return Number.isInteger(beatType) && BEAT_TYPES.includes(beatType);
};

const isValidTimeSignature = (timeSignature: TimeSignature) => {
  return (
    Number.isInteger(timeSignature.measureNumber) &&
    Number.isInteger(timeSignature.beats) &&
    timeSignature.measureNumber > 0 &&
    timeSignature.beats > 0 &&
    isValidBeatType(timeSignature.beatType)
  );
};

const isValidNote = (note: Note) => {
  return (
    Number.isInteger(note.position) &&
    Number.isInteger(note.duration) &&
    Number.isInteger(note.noteNumber) &&
    note.position >= 0 &&
    note.duration > 0 &&
    note.noteNumber >= 0 &&
    note.noteNumber <= 127
  );
};

const isValidTempos = (tempos: Tempo[]) => {
  return (
    tempos.length > 0 &&
    tempos[0].position === 0 &&
    tempos.every((value) => isValidTempo(value))
  );
};

const isValidTimeSignatures = (timeSignatures: TimeSignature[]) => {
  return (
    timeSignatures.length > 0 &&
    timeSignatures[0].measureNumber === 1 &&
    timeSignatures.every((value) => isValidTimeSignature(value))
  );
};

const isValidNotes = (notes: Note[]) => {
  return notes.every((value) => isValidNote(value));
};

const isValidScore = (score: Score) => {
  return (
    isValidTpqn(score.tpqn) &&
    isValidTempos(score.tempos) &&
    isValidTimeSignatures(score.timeSignatures) &&
    isValidNotes(score.notes)
  );
};

type NoteInfo = {
  startTicks: number;
  endTicks: number;
  overlappingNoteIds: Set<string>;
};

class OverlappingNotesDetector {
  private readonly noteInfos = new Map<string, NoteInfo>();

  addNotes(notes: Note[]) {
    for (const note of notes) {
      this.noteInfos.set(note.id, {
        startTicks: note.position,
        endTicks: note.position + note.duration,
        overlappingNoteIds: new Set<string>(),
      });
    }
    // TODO: 計算量がO(n^2)になっているので、区間木などを使用してO(nlogn)にする
    for (const note of notes) {
      const overlappingNoteIds = new Set<string>();
      for (const [noteId, noteInfo] of this.noteInfos) {
        if (noteId === note.id) {
          continue;
        }
        if (noteInfo.startTicks >= note.position + note.duration) {
          continue;
        }
        if (noteInfo.endTicks <= note.position) {
          continue;
        }
        overlappingNoteIds.add(noteId);
      }

      const noteId1 = note.id;
      const noteInfo1 = this.noteInfos.get(noteId1);
      if (!noteInfo1) {
        throw new Error("noteInfo1 is undefined.");
      }
      for (const noteId2 of overlappingNoteIds) {
        const noteInfo2 = this.noteInfos.get(noteId2);
        if (!noteInfo2) {
          throw new Error("noteInfo2 is undefined.");
        }
        noteInfo2.overlappingNoteIds.add(noteId1);
        noteInfo1.overlappingNoteIds.add(noteId2);
      }
    }
  }

  removeNotes(notes: Note[]) {
    for (const note of notes) {
      const noteId1 = note.id;
      const noteInfo1 = this.noteInfos.get(noteId1);
      if (!noteInfo1) {
        throw new Error("noteInfo1 is undefined.");
      }
      for (const noteId2 of noteInfo1.overlappingNoteIds) {
        const noteInfo2 = this.noteInfos.get(noteId2);
        if (!noteInfo2) {
          throw new Error("noteInfo2 is undefined.");
        }
        noteInfo2.overlappingNoteIds.delete(noteId1);
        noteInfo1.overlappingNoteIds.delete(noteId2);
      }
    }
    for (const note of notes) {
      this.noteInfos.delete(note.id);
    }
  }

  updateNotes(notes: Note[]) {
    this.removeNotes(notes);
    this.addNotes(notes);
  }

  getOverlappingNoteIds() {
    const overlappingNoteIds = new Set<string>();
    for (const [noteId, noteInfo] of this.noteInfos) {
      if (noteInfo.overlappingNoteIds.size !== 0) {
        overlappingNoteIds.add(noteId);
      }
    }
    return overlappingNoteIds;
  }
}

let audioContext: AudioContext | undefined;
let transport: Transport | undefined;
let previewSynth: PolySynth | undefined;
let channelStrip: ChannelStrip | undefined;
let limiter: Limiter | undefined;
let clipper: Clipper | undefined;

// NOTE: テスト時はAudioContextが存在しない
if (window.AudioContext) {
  audioContext = new AudioContext();
  transport = new Transport(audioContext);
  previewSynth = new PolySynth(audioContext);
  channelStrip = new ChannelStrip(audioContext);
  limiter = new Limiter(audioContext);
  clipper = new Clipper(audioContext);

  previewSynth.output.connect(channelStrip.input);
  channelStrip.output.connect(limiter.input);
  limiter.output.connect(clipper.input);
  clipper.output.connect(audioContext.destination);
}

type PhraseData = {
  blob?: Blob;
  source?: Instrument | AudioPlayer; // ひとまずPhraseDataに持たせる
  sequence?: Sequence; // ひとまずPhraseDataに持たせる
};

const playheadPosition = new FrequentlyUpdatedState(0);
const overlappingNotesDetector = new OverlappingNotesDetector();
const phraseDataMap = new Map<string, PhraseData>();
const phraseAudioBlobCache = new Map<string, Blob>();
const animationFrameRunner = new AnimationFrameRunner();

export const singingStoreState: SingingStoreState = {
  singer: undefined,
  score: {
    tpqn: DEFAULT_TPQN,
    tempos: [
      {
        position: 0,
        bpm: DEFAULT_BPM,
      },
    ],
    timeSignatures: [
      {
        measureNumber: 1,
        beats: DEFAULT_BEATS,
        beatType: DEFAULT_BEAT_TYPE,
      },
    ],
    notes: [],
  },
  phrases: {},
  // NOTE: UIの状態は試行のためsinging.tsに局所化する+Hydrateが必要
  isShowSinger: true,
  sequencerZoomX: 0.5,
  sequencerZoomY: 0.75,
  sequencerSnapType: 16, // スナップタイプ
  selectedNoteIds: new Set(),
  overlappingNoteIds: new Set(),
  nowPlaying: false,
  volume: 0,
  leftLocatorPosition: 0,
  rightLocatorPosition: 0,
  startRenderingRequested: false,
  stopRenderingRequested: false,
  nowRendering: false,
  nowAudioExporting: false,
  cancellationOfAudioExportRequested: false,
};

export const singingStore = createPartialStore<SingingStoreTypes>({
  SET_SHOW_SINGER: {
    mutation(state, { isShowSinger }: { isShowSinger: boolean }) {
      state.isShowSinger = isShowSinger;
    },
    async action({ commit }, { isShowSinger }) {
      commit("SET_SHOW_SINGER", {
        isShowSinger,
      });
    },
  },

  SET_SINGER: {
    mutation(state, { singer }: { singer?: Singer }) {
      state.singer = singer;
    },
    async action(
      { state, getters, dispatch, commit },
      { singer }: { singer?: Singer }
    ) {
      if (state.defaultStyleIds == undefined)
        throw new Error("state.defaultStyleIds == undefined");
      if (getters.USER_ORDERED_CHARACTER_INFOS == undefined)
        throw new Error("state.characterInfos == undefined");
      const userOrderedCharacterInfos = getters.USER_ORDERED_CHARACTER_INFOS;

      const engineId = singer?.engineId ?? state.engineIds[0];

      // FIXME: engineIdも含めて探査する
      const styleId =
        singer?.styleId ??
        state.defaultStyleIds[
          state.defaultStyleIds.findIndex(
            (x) =>
              x.speakerUuid === userOrderedCharacterInfos[0].metas.speakerUuid // FIXME: defaultStyleIds内にspeakerUuidがない場合がある
          )
        ].defaultStyleId;

      try {
        // 指定されたstyleIdに対して、エンジン側の初期化を行う
        const isInitialized = await dispatch("IS_INITIALIZED_ENGINE_SPEAKER", {
          engineId,
          styleId,
        });
        if (!isInitialized) {
          await dispatch("INITIALIZE_ENGINE_SPEAKER", {
            engineId,
            styleId,
          });
        }
      } finally {
        commit("SET_SINGER", { singer: { engineId, styleId } });

        dispatch("RENDER");
      }
    },
  },

  SET_SCORE: {
    mutation(state, { score }: { score: Score }) {
      const oldNotes = state.score.notes;
      state.score = score;
      state.selectedNoteIds.clear();
      overlappingNotesDetector.removeNotes(oldNotes);
      overlappingNotesDetector.addNotes(score.notes);
      state.overlappingNoteIds =
        overlappingNotesDetector.getOverlappingNoteIds();
    },
    async action(
      { state, getters, commit, dispatch },
      { score }: { score: Score }
    ) {
      if (!isValidScore(score)) {
        throw new Error("The score is invalid.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        await dispatch("SING_STOP_AUDIO");
      }
      commit("SET_SCORE", { score });
      transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

      dispatch("RENDER");
    },
  },

  SET_TEMPO: {
    mutation(state, { tempo }: { tempo: Tempo }) {
      const index = state.score.tempos.findIndex((value) => {
        return value.position === tempo.position;
      });
      const tempos = [...state.score.tempos];
      if (index !== -1) {
        tempos.splice(index, 1, tempo);
      } else {
        tempos.push(tempo);
        tempos.sort((a, b) => a.position - b.position);
      }
      state.score.tempos = tempos;
    },
    // テンポを設定する。既に同じ位置にテンポが存在する場合は置き換える。
    async action(
      { state, getters, commit, dispatch },
      { tempo }: { tempo: Tempo }
    ) {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (!isValidTempo(tempo)) {
        throw new Error("The tempo is invalid.");
      }
      if (state.nowPlaying) {
        playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
      }
      tempo.bpm = round(tempo.bpm, 2);
      commit("SET_TEMPO", { tempo });
      transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

      dispatch("RENDER");
    },
  },

  REMOVE_TEMPO: {
    mutation(state, { position }: { position: number }) {
      const index = state.score.tempos.findIndex((value) => {
        return value.position === position;
      });
      if (index === -1) {
        throw new Error("The tempo does not exist.");
      }
      const tempos = [...state.score.tempos];
      if (index === 0) {
        tempos.splice(index, 1, {
          position: 0,
          bpm: DEFAULT_BPM,
        });
      } else {
        tempos.splice(index, 1);
      }
      state.score.tempos = tempos;
    },
    // テンポを削除する。先頭のテンポの場合はデフォルトのテンポに置き換える。
    async action(
      { state, getters, commit, dispatch },
      { position }: { position: number }
    ) {
      const exists = state.score.tempos.some((value) => {
        return value.position === position;
      });
      if (!exists) {
        throw new Error("The tempo does not exist.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
      }
      commit("REMOVE_TEMPO", { position });
      transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

      dispatch("RENDER");
    },
  },

  SET_TIME_SIGNATURE: {
    mutation(state, { timeSignature }: { timeSignature: TimeSignature }) {
      const index = state.score.timeSignatures.findIndex((value) => {
        return value.measureNumber === timeSignature.measureNumber;
      });
      const timeSignatures = [...state.score.timeSignatures];
      if (index !== -1) {
        timeSignatures.splice(index, 1, timeSignature);
      } else {
        timeSignatures.push(timeSignature);
        timeSignatures.sort((a, b) => a.measureNumber - b.measureNumber);
      }
      state.score.timeSignatures = timeSignatures;
    },
    // 拍子を設定する。既に同じ位置に拍子が存在する場合は置き換える。
    async action(
      { commit },
      { timeSignature }: { timeSignature: TimeSignature }
    ) {
      if (!isValidTimeSignature(timeSignature)) {
        throw new Error("The time signature is invalid.");
      }
      commit("SET_TIME_SIGNATURE", { timeSignature });
    },
  },

  REMOVE_TIME_SIGNATURE: {
    mutation(state, { measureNumber }: { measureNumber: number }) {
      const index = state.score.timeSignatures.findIndex((value) => {
        return value.measureNumber === measureNumber;
      });
      if (index === -1) {
        throw new Error("The time signature does not exist.");
      }
      const timeSignatures = [...state.score.timeSignatures];
      if (index === 0) {
        timeSignatures.splice(index, 1, {
          measureNumber: 1,
          beats: DEFAULT_BEATS,
          beatType: DEFAULT_BEAT_TYPE,
        });
      } else {
        timeSignatures.splice(index, 1);
      }
      state.score.timeSignatures = timeSignatures;
    },
    // 拍子を削除する。先頭の拍子の場合はデフォルトの拍子に置き換える。
    async action(
      { state, commit },
      { measureNumber }: { measureNumber: number }
    ) {
      const exists = state.score.timeSignatures.some((value) => {
        return value.measureNumber === measureNumber;
      });
      if (!exists) {
        throw new Error("The time signature does not exist.");
      }
      commit("REMOVE_TIME_SIGNATURE", { measureNumber });
    },
  },

  ADD_NOTES: {
    mutation(state, { notes }: { notes: Note[] }) {
      const noteIds = notes.map((value) => value.id);
      const scoreNotes = [...state.score.notes, ...notes];
      scoreNotes.sort((a, b) => a.position - b.position);
      state.score.notes = scoreNotes;
      const selectedNoteIds = new Set(state.selectedNoteIds);
      for (const noteId of noteIds) {
        selectedNoteIds.add(noteId);
      }
      state.selectedNoteIds = selectedNoteIds;
      overlappingNotesDetector.addNotes(notes);
      state.overlappingNoteIds =
        overlappingNotesDetector.getOverlappingNoteIds();
    },
    async action({ state, commit, dispatch }, { notes }: { notes: Note[] }) {
      const scoreNotes = state.score.notes;
      const existingIds = new Set(scoreNotes.map((value) => value.id));
      const isValidNotes = notes.every((value) => {
        return !existingIds.has(value.id) && isValidNote(value);
      });
      if (!isValidNotes) {
        throw new Error("The notes are invalid.");
      }
      commit("ADD_NOTES", { notes });

      dispatch("RENDER");
    },
  },

  UPDATE_NOTES: {
    mutation(state, { notes }: { notes: Note[] }) {
      const notesMap = new Map<string, Note>();
      for (const note of notes) {
        notesMap.set(note.id, note);
      }
      const scoreNotes = state.score.notes.map((value) => {
        return notesMap.get(value.id) ?? value;
      });
      scoreNotes.sort((a, b) => a.position - b.position);
      state.score.notes = scoreNotes;
      overlappingNotesDetector.updateNotes(notes);
      state.overlappingNoteIds =
        overlappingNotesDetector.getOverlappingNoteIds();
    },
    async action({ state, commit, dispatch }, { notes }: { notes: Note[] }) {
      const scoreNotes = state.score.notes;
      const existingIds = new Set(scoreNotes.map((value) => value.id));
      const isValidNotes = notes.every((value) => {
        return existingIds.has(value.id) && isValidNote(value);
      });
      if (!isValidNotes) {
        throw new Error("The notes are invalid.");
      }
      commit("UPDATE_NOTES", { notes });

      dispatch("RENDER");
    },
  },

  REMOVE_NOTES: {
    mutation(state, { noteIds }: { noteIds: string[] }) {
      const noteIdsSet = new Set(noteIds);
      const notes = state.score.notes.filter((value) => {
        return noteIdsSet.has(value.id);
      });
      state.score.notes = state.score.notes.filter((value) => {
        return !noteIdsSet.has(value.id);
      });
      const selectedNoteIds = new Set(state.selectedNoteIds);
      for (const noteId of noteIds) {
        selectedNoteIds.delete(noteId);
      }
      state.selectedNoteIds = selectedNoteIds;
      overlappingNotesDetector.removeNotes(notes);
      state.overlappingNoteIds =
        overlappingNotesDetector.getOverlappingNoteIds();
    },
    async action(
      { state, commit, dispatch },
      { noteIds }: { noteIds: string[] }
    ) {
      const scoreNotes = state.score.notes;
      const existingIds = new Set(scoreNotes.map((value) => value.id));
      const isValidNoteIds = noteIds.every((value) => existingIds.has(value));
      if (!isValidNoteIds) {
        throw new Error("The note ids are invalid.");
      }
      commit("REMOVE_NOTES", { noteIds });

      dispatch("RENDER");
    },
  },

  SELECT_NOTES: {
    mutation(state, { noteIds }: { noteIds: string[] }) {
      const selectedNoteIds = new Set(state.selectedNoteIds);
      for (const noteId of noteIds) {
        selectedNoteIds.add(noteId);
      }
      state.selectedNoteIds = selectedNoteIds;
    },
    async action({ state, commit }, { noteIds }: { noteIds: string[] }) {
      const scoreNotes = state.score.notes;
      const existingIds = new Set(scoreNotes.map((value) => value.id));
      if (!noteIds.every((value) => existingIds.has(value))) {
        throw new Error("The note ids are invalid.");
      }
      commit("SELECT_NOTES", { noteIds });
    },
  },

  DESELECT_ALL_NOTES: {
    mutation(state) {
      state.selectedNoteIds = new Set();
    },
    async action({ commit }) {
      commit("DESELECT_ALL_NOTES");
    },
  },

  REMOVE_SELECTED_NOTES: {
    async action({ state, commit, dispatch }) {
      commit("REMOVE_NOTES", { noteIds: [...state.selectedNoteIds] });

      dispatch("RENDER");
    },
  },

  SET_PHRASE: {
    mutation(
      state,
      { phraseKey, phrase }: { phraseKey: string; phrase: Phrase }
    ) {
      state.phrases[phraseKey] = phrase;
    },
  },

  DELETE_PHRASE: {
    mutation(state, { phraseKey }: { phraseKey: string }) {
      delete state.phrases[phraseKey];
    },
  },

  SET_STATE_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        phraseState,
      }: { phraseKey: string; phraseState: PhraseState }
    ) {
      state.phrases[phraseKey].state = phraseState;
    },
  },

  SET_AUDIO_QUERY_TO_PHRASE: {
    mutation(
      state,
      { phraseKey, audioQuery }: { phraseKey: string; audioQuery: AudioQuery }
    ) {
      state.phrases[phraseKey].query = audioQuery;
    },
  },

  SET_START_TIME_TO_PHRASE: {
    mutation(
      state,
      { phraseKey, startTime }: { phraseKey: string; startTime: number }
    ) {
      state.phrases[phraseKey].startTime = startTime;
    },
  },

  SET_SNAP_TYPE: {
    mutation(state, { snapType }) {
      state.sequencerSnapType = snapType;
    },
    async action({ state, commit }, { snapType }) {
      const tpqn = state.score.tpqn;
      if (!isValidSnapType(snapType, tpqn)) {
        throw new Error("The snap type is invalid.");
      }
      commit("SET_SNAP_TYPE", { snapType });
    },
  },

  SET_ZOOM_X: {
    mutation(state, { zoomX }: { zoomX: number }) {
      state.sequencerZoomX = zoomX;
    },
    async action({ commit }, { zoomX }) {
      commit("SET_ZOOM_X", {
        zoomX,
      });
    },
  },

  SET_ZOOM_Y: {
    mutation(state, { zoomY }: { zoomY: number }) {
      state.sequencerZoomY = zoomY;
    },
    async action({ commit }, { zoomY }) {
      commit("SET_ZOOM_Y", {
        zoomY,
      });
    },
  },

  TICK_TO_SECOND: {
    getter: (state) => (position) => {
      const tpqn = state.score.tpqn;
      const tempos = state.score.tempos;
      return tickToSecond(position, tempos, tpqn);
    },
  },

  SECOND_TO_TICK: {
    getter: (state) => (time) => {
      const tpqn = state.score.tpqn;
      const tempos = state.score.tempos;
      return secondToTick(time, tempos, tpqn);
    },
  },

  GET_PLAYHEAD_POSITION: {
    getter: (state, getters) => () => {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        playheadPosition.value = getters.SECOND_TO_TICK(transport.time);
      }
      return playheadPosition.value;
    },
  },

  SET_PLAYHEAD_POSITION: {
    async action({ getters }, { position }: { position: number }) {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      playheadPosition.value = position;
      transport.time = getters.TICK_TO_SECOND(position);
    },
  },

  ADD_PLAYHEAD_POSITION_CHANGE_LISTENER: {
    async action(_, { listener }: { listener: (position: number) => void }) {
      playheadPosition.addValueChangeListener(listener);
    },
  },

  REMOVE_PLAYHEAD_POSITION_CHANGE_LISTENER: {
    async action(_, { listener }: { listener: (position: number) => void }) {
      playheadPosition.removeValueChangeListener(listener);
    },
  },

  SET_LEFT_LOCATOR_POSITION: {
    mutation(state, { position }) {
      state.leftLocatorPosition = position;
    },
    async action({ commit }, { position }) {
      commit("SET_LEFT_LOCATOR_POSITION", { position });
    },
  },

  SET_RIGHT_LOCATOR_POSITION: {
    mutation(state, { position }) {
      state.rightLocatorPosition = position;
    },
    async action({ commit }, { position }) {
      commit("SET_RIGHT_LOCATOR_POSITION", { position });
    },
  },

  SET_PLAYBACK_STATE: {
    mutation(state, { nowPlaying }) {
      state.nowPlaying = nowPlaying;
    },
  },

  SING_PLAY_AUDIO: {
    async action({ state, getters, commit }) {
      if (state.nowPlaying) {
        return;
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      commit("SET_PLAYBACK_STATE", { nowPlaying: true });

      transport.start();
      animationFrameRunner.start(() => {
        playheadPosition.value = getters.GET_PLAYHEAD_POSITION();
      });
    },
  },

  SING_STOP_AUDIO: {
    async action({ state, getters, commit }) {
      if (!state.nowPlaying) {
        return;
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      commit("SET_PLAYBACK_STATE", { nowPlaying: false });

      transport.stop();
      animationFrameRunner.stop();
      playheadPosition.value = getters.GET_PLAYHEAD_POSITION();
    },
  },

  SET_VOLUME: {
    mutation(state, { volume }) {
      state.volume = volume;
    },
    async action({ commit }, { volume }) {
      if (!channelStrip) {
        throw new Error("channelStrip is undefined.");
      }
      commit("SET_VOLUME", { volume });

      channelStrip.volume = volume;
    },
  },

  PLAY_PREVIEW_SOUND: {
    async action(
      _,
      { noteNumber, duration }: { noteNumber: number; duration?: number }
    ) {
      if (!audioContext) {
        throw new Error("audioContext is undefined.");
      }
      if (!previewSynth) {
        throw new Error("previewSynth is undefined.");
      }
      previewSynth.noteOn(0, noteNumber);
      if (duration !== undefined) {
        const contextTime = audioContext.currentTime;
        previewSynth.noteOff(contextTime + duration, noteNumber);
      }
    },
  },

  STOP_PREVIEW_SOUND: {
    async action(_, { noteNumber }: { noteNumber: number }) {
      if (!audioContext) {
        throw new Error("audioContext is undefined.");
      }
      if (!previewSynth) {
        throw new Error("previewSynth is undefined.");
      }
      previewSynth.noteOff(0, noteNumber);
    },
  },

  SET_IS_DRAG: {
    mutation(state, { isDrag }: { isDrag: boolean }) {
      state.isDrag = isDrag;
    },
    async action({ commit }, { isDrag }) {
      commit("SET_IS_DRAG", {
        isDrag,
      });
    },
  },

  UPDATE_PERIODIC_PITCH: {
    async action({ dispatch }, { audioQuery, engineId, styleId }) {
      try {
        const instance = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId,
        });
        return await instance.invoke("periodicPitchPeriodicPitchPost")({
          audioQuery,
          speaker: styleId,
        });
      } catch (error) {
        window.electron.logError(error, `Failed to update periodic pitch.`);
        throw error;
      }
    },
  },

  SET_START_RENDERING_REQUESTED: {
    mutation(state, { startRenderingRequested }) {
      state.startRenderingRequested = startRenderingRequested;
    },
  },

  SET_STOP_RENDERING_REQUESTED: {
    mutation(state, { stopRenderingRequested }) {
      state.stopRenderingRequested = stopRenderingRequested;
    },
  },

  SET_NOW_RENDERING: {
    mutation(state, { nowRendering }) {
      state.nowRendering = nowRendering;
    },
  },

  /**
   * レンダリングを行う。レンダリング中だった場合は停止して再レンダリングする。
   */
  RENDER: {
    async action({ state, getters, commit, dispatch }) {
      const deleteOverlappingNotes = (
        score: Score,
        overlappingNoteIds: Set<string>
      ) => {
        score.notes = score.notes.filter((value) => {
          return !overlappingNoteIds.has(value.id);
        });
      };

      const searchPhrases = async (
        singer: Singer | undefined,
        score: Score
      ) => {
        const notes = score.notes;
        const foundPhrases = new Map<string, Phrase>();
        let phraseNotes: Note[] = [];
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];

          phraseNotes.push(note);

          if (
            i === notes.length - 1 ||
            note.position + note.duration !== notes[i + 1].position
          ) {
            const phraseScore = {
              ...score,
              notes: phraseNotes,
            };
            const phraseFirstNote = phraseNotes[0];
            const phraseLastNote = phraseNotes[phraseNotes.length - 1];
            const hash = await generateSingerAndScoreHash({
              singer,
              score: phraseScore, // NOTE: とりあえず拍子も含めてハッシュ生成する
            });
            foundPhrases.set(hash, {
              singer,
              score: phraseScore,
              startTicks: phraseFirstNote.position,
              endTicks: phraseLastNote.position + phraseLastNote.duration,
              state: "WAITING_TO_BE_RENDERED",
            });

            phraseNotes = [];
          }
        }
        return foundPhrases;
      };

      const getSortedPhrasesEntries = (phrases: Record<string, Phrase>) => {
        return Object.entries(phrases).sort((a, b) => {
          return a[1].startTicks - b[1].startTicks;
        });
      };

      const fetchQuery = async (singer: Singer, score: Score) => {
        if (!getters.IS_ENGINE_READY(singer.engineId)) {
          throw new Error("Engine not ready.");
        }

        // TODO: 助詞や拗音の扱いはあとで考える
        const text = score.notes
          .map((value) => value.lyric)
          .map((value) => value.replace("じょ", "ジョ"))
          .map((value) => value.replace("うぉ", "ウォ"))
          .map((value) => value.replace("は", "ハ"))
          .map((value) => value.replace("へ", "ヘ"))
          .join("");

        const query = await dispatch("FETCH_AUDIO_QUERY", {
          text,
          engineId: singer.engineId,
          styleId: singer.styleId,
        });
        return query;
      };

      const getMoras = (query: AudioQuery) => {
        return query.accentPhrases.map((value) => value.moras).flat();
      };

      const logPhonemes = (moras: Mora[]) => {
        const phonemes = moras
          .map((value) => {
            if (value.consonant === undefined) {
              return [value.vowel];
            } else {
              return [value.consonant, value.vowel];
            }
          })
          .flat()
          .join(" ");
        window.electron.logInfo(`  phonemes: ${phonemes}`);
      };

      const editQuery = (score: Score, query: AudioQuery) => {
        let noteIndex = 0;
        for (let i = 0; i < query.accentPhrases.length; i++) {
          const accentPhrase = query.accentPhrases[i];
          const moras = accentPhrase.moras;
          for (let j = 0; j < moras.length; j++) {
            const mora = moras[j];
            const note = score.notes[noteIndex];

            const noteOnTime = tickToSecond(
              note.position,
              score.tempos,
              score.tpqn
            );
            const noteOffTime = tickToSecond(
              note.position + note.duration,
              score.tempos,
              score.tpqn
            );

            // 長さを編集
            let nextMora: Mora | undefined;
            if (j !== moras.length - 1) {
              nextMora = moras[j + 1];
            } else if (i !== query.accentPhrases.length - 1) {
              const nextAccentPhrase = query.accentPhrases[i + 1];
              nextMora = nextAccentPhrase.moras[0];
            }
            const minVowelLength = 0.01;
            const minConsonantLength = 0.02;
            const noteLength = noteOffTime - noteOnTime;
            if (nextMora && nextMora.consonantLength !== undefined) {
              // 母音の後ろに子音がある場合
              mora.vowelLength = noteLength - nextMora.consonantLength;
              if (mora.vowelLength < minVowelLength) {
                // 母音をこれ以上短くできない場合は、子音を短くする
                mora.vowelLength = minVowelLength;
                nextMora.consonantLength = noteLength - mora.vowelLength;
                if (nextMora.consonantLength < minConsonantLength) {
                  // 子音も短くできない場合は、比で母音と子音の長さを決定する
                  const minMoraLength = minVowelLength + minConsonantLength;
                  const vowelRatio = minVowelLength / minMoraLength;
                  const consonantRatio = minConsonantLength / minMoraLength;
                  mora.vowelLength = noteLength * vowelRatio;
                  nextMora.consonantLength = noteLength * consonantRatio;
                }
              }
            } else {
              // 母音の後ろに子音がない場合
              mora.vowelLength = noteLength;
            }

            // 音高を編集
            const freq = noteNumberToFrequency(note.noteNumber);
            mora.pitch = Math.log(freq);

            // 無声化を解除
            if (mora.vowel === "I") {
              mora.vowel = "i";
            }
            if (mora.vowel === "U") {
              mora.vowel = "u";
            }

            noteIndex++;
          }
        }
      };

      const updatePeriodicPitch = async (singer: Singer, query: AudioQuery) => {
        if (!getters.IS_ENGINE_READY(singer.engineId)) {
          throw new Error("Engine not ready.");
        }

        const newQuery = await dispatch("UPDATE_PERIODIC_PITCH", {
          audioQuery: query,
          engineId: singer.engineId,
          styleId: singer.styleId,
        });
        return newQuery;
      };

      const calcStartTime = (score: Score, query: AudioQuery) => {
        const firstMora = query.accentPhrases[0].moras[0];
        let startTime = tickToSecond(
          score.notes[0].position,
          score.tempos,
          score.tpqn
        );
        startTime -= query.prePhonemeLength;
        startTime -= firstMora.consonantLength ?? 0;
        return startTime;
      };

      const synthesize = async (singer: Singer, query: AudioQuery) => {
        if (!getters.IS_ENGINE_READY(singer.engineId)) {
          throw new Error("Engine not ready.");
        }

        const blob = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
          engineId: singer.engineId,
        }).then((instance) => {
          return instance.invoke("synthesisSynthesisPost")({
            audioQuery: query,
            speaker: singer.styleId,
            enableInterrogativeUpspeak:
              state.experimentalSetting.enableInterrogativeUpspeak,
          });
        });
        return blob;
      };

      // NOTE: 型推論でawaitの前か後かが考慮されないので、関数を介して取得する（型がbooleanになるようにする）
      const startRenderingRequested = () => state.startRenderingRequested;
      const stopRenderingRequested = () => state.stopRenderingRequested;

      const render = async () => {
        if (!audioContext || !transport || !channelStrip) {
          throw new Error(
            "audioContext or transport or channelStrip is undefined."
          );
        }
        const audioContextRef = audioContext;
        const transportRef = transport;
        const channelStripRef = channelStrip;

        // レンダリング中に変更される可能性のあるデータをコピーする
        const score = copyScore(state.score);
        const singer = copySinger(state.singer);

        deleteOverlappingNotes(score, state.overlappingNoteIds);

        // Score -> Phrases

        window.electron.logInfo("Updating phrases...");

        const foundPhrases = await searchPhrases(singer, score);
        for (const [hash, phrase] of foundPhrases) {
          const key = hash;
          if (!Object.hasOwn(state.phrases, key)) {
            commit("SET_PHRASE", { phraseKey: key, phrase });

            // フレーズ追加時の処理
            const noteEvents = generateNoteEvents(
              phrase.score.notes,
              phrase.score.tempos,
              phrase.score.tpqn
            );
            const polySynth = new PolySynth(audioContextRef);
            polySynth.output.connect(channelStripRef.input);
            const noteSequence: NoteSequence = {
              type: "note",
              instrument: polySynth,
              noteEvents,
            };
            transportRef.addSequence(noteSequence);
            phraseDataMap.set(key, {
              source: polySynth,
              sequence: noteSequence,
            });
          }
        }
        for (const key of Object.keys(state.phrases)) {
          if (!foundPhrases.has(key)) {
            commit("DELETE_PHRASE", { phraseKey: key });

            // フレーズ削除時の処理
            const phraseData = phraseDataMap.get(key);
            if (!phraseData) {
              throw new Error("phraseData is undefined");
            }
            if (phraseData.source) {
              phraseData.source.output.disconnect();
            }
            if (phraseData.sequence) {
              transportRef.removeSequence(phraseData.sequence);
            }
            phraseDataMap.delete(key);
          }
        }

        window.electron.logInfo("Phrases updated.");

        if (startRenderingRequested() || stopRenderingRequested()) {
          return;
        }

        for (const [key, phrase] of getSortedPhrasesEntries(state.phrases)) {
          if (!phrase.singer) {
            continue;
          }

          if (phrase.state === "WAITING_TO_BE_RENDERED") {
            commit("SET_STATE_TO_PHRASE", {
              phraseKey: key,
              phraseState: "NOW_RENDERING",
            });
          }

          // Singer & Score -> AudioQuery
          // Score & AudioQuery -> StartTime

          if (!phrase.query) {
            window.electron.logInfo(`Generating query...`);

            let audioQuery = await fetchQuery(phrase.singer, phrase.score);
            const moras = getMoras(audioQuery);
            logPhonemes(moras);
            if (moras.length !== phrase.score.notes.length) {
              commit("SET_STATE_TO_PHRASE", {
                phraseKey: key,
                phraseState: "COULD_NOT_RENDER",
              });
              continue;
            }
            editQuery(phrase.score, audioQuery);
            audioQuery = await updatePeriodicPitch(phrase.singer, audioQuery);
            const startTime = calcStartTime(phrase.score, audioQuery);

            commit("SET_AUDIO_QUERY_TO_PHRASE", { phraseKey: key, audioQuery });
            commit("SET_START_TIME_TO_PHRASE", { phraseKey: key, startTime });

            window.electron.logInfo(`Query generated.`);
          }

          if (startRenderingRequested() || stopRenderingRequested()) {
            if (phrase.state === "NOW_RENDERING") {
              commit("SET_STATE_TO_PHRASE", {
                phraseKey: key,
                phraseState: "WAITING_TO_BE_RENDERED",
              });
            }
            return;
          }

          // AudioQuery -> Blob
          // Blob & StartTime -> AudioSequence

          const phraseData = phraseDataMap.get(key);
          if (!phraseData) {
            throw new Error("phraseData is undefined");
          }
          if (!phrase.query) {
            throw new Error("query is undefined.");
          }
          if (phrase.startTime === undefined) {
            throw new Error("startTime is undefined.");
          }
          if (!phraseData.blob) {
            phraseData.blob = phraseAudioBlobCache.get(key);
            if (phraseData.blob) {
              window.electron.logInfo(`Loaded audio buffer from cache.`);
            } else {
              window.electron.logInfo(`Synthesizing...`);

              phraseData.blob = await synthesize(phrase.singer, phrase.query);
              phraseAudioBlobCache.set(key, phraseData.blob);

              window.electron.logInfo(`Synthesized.`);
            }

            // 音源とシーケンスを作成し直して、再接続する
            if (phraseData.source) {
              phraseData.source.output.disconnect();
            }
            if (phraseData.sequence) {
              transportRef.removeSequence(phraseData.sequence);
            }
            const audioPlayer = new AudioPlayer(audioContextRef);
            const audioEvents = await generateAudioEvents(
              audioContextRef,
              phrase.startTime,
              phraseData.blob
            );
            const audioSequence: AudioSequence = {
              type: "audio",
              audioPlayer,
              audioEvents,
            };
            audioPlayer.output.connect(channelStripRef.input);
            transportRef.addSequence(audioSequence);
            phraseData.source = audioPlayer;
            phraseData.sequence = audioSequence;
          }

          if (phrase.state === "NOW_RENDERING") {
            commit("SET_STATE_TO_PHRASE", {
              phraseKey: key,
              phraseState: "PLAYABLE",
            });
          }

          if (startRenderingRequested() || stopRenderingRequested()) {
            return;
          }
        }
      };

      commit("SET_START_RENDERING_REQUESTED", {
        startRenderingRequested: true,
      });
      if (state.nowRendering) {
        return;
      }

      commit("SET_NOW_RENDERING", { nowRendering: true });
      try {
        while (startRenderingRequested()) {
          commit("SET_START_RENDERING_REQUESTED", {
            startRenderingRequested: false,
          });
          await render();
          if (stopRenderingRequested()) {
            break;
          }
        }
      } catch (e) {
        window.electron.logError(e);
        throw e;
      } finally {
        commit("SET_STOP_RENDERING_REQUESTED", {
          stopRenderingRequested: false,
        });
        commit("SET_NOW_RENDERING", { nowRendering: false });
      }
    },
  },

  /**
   * レンダリング停止をリクエストし、停止するまで待機する。
   */
  STOP_RENDERING: {
    action: createUILockAction(async ({ state, commit }) => {
      if (state.nowRendering) {
        window.electron.logInfo("Waiting for rendering to stop...");
        commit("SET_STOP_RENDERING_REQUESTED", {
          stopRenderingRequested: true,
        });
        await createPromiseThatResolvesWhen(() => !state.nowRendering);
        window.electron.logInfo("Rendering stopped.");
      }
    }),
  },

  IMPORT_MIDI_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        const convertPosition = (
          position: number,
          sourceTpqn: number,
          targetTpqn: number
        ) => {
          return Math.round(position * (targetTpqn / sourceTpqn));
        };

        const convertDuration = (
          startPosition: number,
          endPosition: number,
          sourceTpqn: number,
          targetTpqn: number
        ) => {
          const convertedEndPosition = convertPosition(
            endPosition,
            sourceTpqn,
            targetTpqn
          );
          const convertedStartPosition = convertPosition(
            startPosition,
            sourceTpqn,
            targetTpqn
          );
          return Math.max(1, convertedEndPosition - convertedStartPosition);
        };

        const getTopNotes = (notes: Note[]) => {
          const topNotes: Note[] = [];
          for (const note of notes) {
            if (topNotes.length === 0) {
              topNotes.push(note);
              continue;
            }
            const topNote = topNotes[topNotes.length - 1];
            const topNoteEndPos = topNote.position + topNote.duration;
            if (topNoteEndPos <= note.position) {
              topNotes.push(note);
              continue;
            }
            if (topNote.noteNumber < note.noteNumber) {
              topNotes.pop();
              topNotes.push(note);
            }
          }
          return topNotes;
        };

        const removeDuplicateTempos = (tempos: Tempo[]) => {
          return tempos.filter((value, index, array) => {
            return (
              index === array.length - 1 ||
              value.position !== array[index + 1].position
            );
          });
        };

        const removeDuplicateTimeSignatures = (
          timeSignatures: TimeSignature[]
        ) => {
          return timeSignatures.filter((value, index, array) => {
            return (
              index === array.length - 1 ||
              value.measureNumber !== array[index + 1].measureNumber
            );
          });
        };

        if (!filePath) {
          filePath = await window.electron.showImportFileDialog({
            title: "MIDI読み込み",
            name: "MIDI",
            extensions: ["mid", "midi"],
          });
          if (!filePath) return;
        }

        const midiData = getValueOrThrow(
          await window.electron.readFile({ filePath })
        );
        const midi = new Midi(midiData);

        const midiTpqn = midi.header.ppq;
        const midiTempos = [...midi.header.tempos];
        const midiTimeSignatures = [...midi.header.timeSignatures];
        // TODO: UIで読み込むトラックを選択できるようにする
        const midiNotes = [...midi.tracks[0].notes]; // ひとまず1トラック目のみを読み込む

        midiTempos.sort((a, b) => a.ticks - b.ticks);
        midiTimeSignatures.sort((a, b) => a.ticks - b.ticks);
        midiNotes.sort((a, b) => a.ticks - b.ticks);

        const tpqn = DEFAULT_TPQN;

        let notes = midiNotes.map((value): Note => {
          return {
            id: uuidv4(),
            position: convertPosition(value.ticks, midiTpqn, tpqn),
            duration: convertDuration(
              value.ticks,
              value.ticks + value.durationTicks,
              midiTpqn,
              tpqn
            ),
            noteNumber: value.midi,
            lyric: getDoremiFromNoteNumber(value.midi),
          };
        });
        // ノートの重なりを考慮して、一番音が高いノート（トップノート）のみインポートする
        notes = getTopNotes(notes);

        let tempos = midiTempos.map((value): Tempo => {
          return {
            position: convertPosition(value.ticks, midiTpqn, tpqn),
            bpm: round(value.bpm, 2),
          };
        });
        tempos.unshift({
          position: 0,
          bpm: DEFAULT_BPM,
        });
        tempos = removeDuplicateTempos(tempos);

        let timeSignatures: TimeSignature[] = [];
        let tsPosition = 0;
        let measureNumber = 1;
        for (let i = 0; i < midiTimeSignatures.length; i++) {
          const midiTs = midiTimeSignatures[i];
          const beats = midiTs.timeSignature[0];
          const beatType = midiTs.timeSignature[1];
          timeSignatures.push({ measureNumber, beats, beatType });
          if (i < midiTimeSignatures.length - 1) {
            const nextTsTicks = midiTimeSignatures[i + 1].ticks;
            const nextTsPos = convertPosition(nextTsTicks, midiTpqn, tpqn);
            const tsDuration = nextTsPos - tsPosition;
            const measureDuration = getMeasureDuration(beats, beatType, tpqn);
            tsPosition = nextTsPos;
            measureNumber += tsDuration / measureDuration;
          }
        }
        timeSignatures.unshift({
          measureNumber: 1,
          beats: DEFAULT_BEATS,
          beatType: DEFAULT_BEAT_TYPE,
        });
        timeSignatures = removeDuplicateTimeSignatures(timeSignatures);

        tempos.splice(1, tempos.length - 1); // TODO: 複数テンポに対応したら削除
        timeSignatures.splice(1, timeSignatures.length - 1); // TODO: 複数拍子に対応したら削除

        await dispatch("SET_SCORE", {
          score: {
            tpqn,
            tempos,
            timeSignatures,
            notes,
          },
        });
      }
    ),
  },

  IMPORT_MUSICXML_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        if (!filePath) {
          filePath = await window.electron.showImportFileDialog({
            title: "MusicXML読み込み",
            name: "MusicXML",
            extensions: ["musicxml", "xml"],
          });
          if (!filePath) return;
        }

        let xmlStr = new TextDecoder("utf-8").decode(
          getValueOrThrow(await window.electron.readFile({ filePath }))
        );
        if (xmlStr.indexOf("\ufffd") > -1) {
          xmlStr = new TextDecoder("shift-jis").decode(
            getValueOrThrow(await window.electron.readFile({ filePath }))
          );
        }

        const tpqn = DEFAULT_TPQN;
        const tempos: Tempo[] = [
          {
            position: 0,
            bpm: DEFAULT_BPM,
          },
        ];
        const timeSignatures: TimeSignature[] = [
          {
            measureNumber: 1,
            beats: DEFAULT_BEATS,
            beatType: DEFAULT_BEAT_TYPE,
          },
        ];
        const notes: Note[] = [];

        let divisions = 1;
        let position = 0;
        let measureNumber = 1;
        let measurePosition = 0;
        let measureDuration = getMeasureDuration(
          timeSignatures[0].beats,
          timeSignatures[0].beatType,
          tpqn
        );
        let tieStartNote: Note | undefined;

        const getChild = (element: Element | undefined, tagName: string) => {
          if (element) {
            for (const childElement of element.children) {
              if (childElement.tagName === tagName) {
                return childElement;
              }
            }
          }
          return undefined;
        };

        const getValueAsNumber = (element: Element) => {
          const value = Number(element.textContent);
          if (Number.isNaN(value)) {
            throw new Error("The value is invalid.");
          }
          return value;
        };

        const getAttributeAsNumber = (
          element: Element,
          qualifiedName: string
        ) => {
          const value = Number(element.getAttribute(qualifiedName));
          if (Number.isNaN(value)) {
            throw new Error("The value is invalid.");
          }
          return value;
        };

        const getStepNumber = (stepElement: Element) => {
          const stepNumberDict: { [key: string]: number } = {
            C: 0,
            D: 2,
            E: 4,
            F: 5,
            G: 7,
            A: 9,
            B: 11,
          };
          const stepChar = stepElement.textContent;
          if (stepChar === null) {
            throw new Error("The value is invalid.");
          }
          return stepNumberDict[stepChar];
        };

        const getDuration = (durationElement: Element) => {
          const duration = getValueAsNumber(durationElement);
          return Math.round((tpqn * duration) / divisions);
        };

        const getTie = (elementThatMayBeTied: Element) => {
          let tie: boolean | undefined;
          for (const childElement of elementThatMayBeTied.children) {
            if (
              childElement.tagName === "tie" ||
              childElement.tagName === "tied"
            ) {
              const tieType = childElement.getAttribute("type");
              if (tieType === "start") {
                tie = true;
              } else if (tieType === "stop") {
                tie = false;
              } else {
                throw new Error("The value is invalid.");
              }
            }
          }
          return tie;
        };

        const parseSound = (soundElement: Element) => {
          if (!soundElement.hasAttribute("tempo")) {
            return;
          }
          if (tempos.length !== 0) {
            const lastTempo = tempos[tempos.length - 1];
            if (lastTempo.position === position) {
              tempos.pop();
            }
          }
          const tempo = getAttributeAsNumber(soundElement, "tempo");
          tempos.push({
            position: position,
            bpm: round(tempo, 2),
          });
        };

        const parseDirection = (directionElement: Element) => {
          for (const childElement of directionElement.children) {
            if (childElement.tagName === "sound") {
              parseSound(childElement);
            }
          }
        };

        const parseDivisions = (divisionsElement: Element) => {
          divisions = getValueAsNumber(divisionsElement);
        };

        const parseTime = (timeElement: Element) => {
          const beatsElement = getChild(timeElement, "beats");
          if (!beatsElement) {
            throw new Error("beats element does not exist.");
          }
          const beatTypeElement = getChild(timeElement, "beat-type");
          if (!beatTypeElement) {
            throw new Error("beat-type element does not exist.");
          }
          const beats = getValueAsNumber(beatsElement);
          const beatType = getValueAsNumber(beatTypeElement);
          measureDuration = getMeasureDuration(beats, beatType, tpqn);
          if (timeSignatures.length !== 0) {
            const lastTimeSignature = timeSignatures[timeSignatures.length - 1];
            if (lastTimeSignature.measureNumber === measureNumber) {
              timeSignatures.pop();
            }
          }
          timeSignatures.push({
            measureNumber,
            beats,
            beatType,
          });
        };

        const parseAttributes = (attributesElement: Element) => {
          for (const childElement of attributesElement.children) {
            if (childElement.tagName === "divisions") {
              parseDivisions(childElement);
            } else if (childElement.tagName === "time") {
              parseTime(childElement);
            } else if (childElement.tagName === "sound") {
              parseSound(childElement);
            }
          }
        };

        const parseNote = (noteElement: Element) => {
          // TODO: ノートの重なり・和音を考慮していないので、
          //       それらが存在する場合でも読み込めるようにする

          const durationElement = getChild(noteElement, "duration");
          if (!durationElement) {
            throw new Error("duration element does not exist.");
          }
          let duration = getDuration(durationElement);
          let noteEnd = position + duration;
          const measureEnd = measurePosition + measureDuration;
          if (noteEnd > measureEnd) {
            // 小節に収まらない場合、ノートの長さを変えて小節に収まるようにする
            duration = measureEnd - position;
            noteEnd = position + duration;
          }

          if (getChild(noteElement, "rest")) {
            position += duration;
            return;
          }

          const pitchElement = getChild(noteElement, "pitch");
          if (!pitchElement) {
            throw new Error("pitch element does not exist.");
          }
          const octaveElement = getChild(pitchElement, "octave");
          if (!octaveElement) {
            throw new Error("octave element does not exist.");
          }
          const stepElement = getChild(pitchElement, "step");
          if (!stepElement) {
            throw new Error("step element does not exist.");
          }
          const alterElement = getChild(pitchElement, "alter");

          const octave = getValueAsNumber(octaveElement);
          const stepNumber = getStepNumber(stepElement);
          let noteNumber = 12 * (octave + 1) + stepNumber;
          if (alterElement) {
            noteNumber += getValueAsNumber(alterElement);
          }

          const lyricElement = getChild(noteElement, "lyric");
          const lyric = getChild(lyricElement, "text")?.textContent ?? "";

          let tie = getTie(noteElement);
          for (const childElement of noteElement.children) {
            if (childElement.tagName === "notations") {
              tie = getTie(childElement);
            }
          }

          const note: Note = {
            id: uuidv4(),
            position,
            duration,
            noteNumber,
            lyric,
          };

          if (tieStartNote) {
            if (tie === false) {
              tieStartNote.duration = noteEnd - tieStartNote.position;
              notes.push(tieStartNote);
              tieStartNote = undefined;
            }
          } else {
            if (tie === true) {
              tieStartNote = note;
            } else {
              notes.push(note);
            }
          }
          position += duration;
        };

        const parseMeasure = (measureElement: Element) => {
          measurePosition = position;
          measureNumber = getAttributeAsNumber(measureElement, "number");
          for (const childElement of measureElement.children) {
            if (childElement.tagName === "direction") {
              parseDirection(childElement);
            } else if (childElement.tagName === "sound") {
              parseSound(childElement);
            } else if (childElement.tagName === "attributes") {
              parseAttributes(childElement);
            } else if (childElement.tagName === "note") {
              if (position < measurePosition + measureDuration) {
                parseNote(childElement);
              }
            }
          }
          const measureEnd = measurePosition + measureDuration;
          if (position !== measureEnd) {
            tieStartNote = undefined;
            position = measureEnd;
          }
        };

        const parsePart = (partElement: Element) => {
          for (const childElement of partElement.children) {
            if (childElement.tagName === "measure") {
              parseMeasure(childElement);
            }
          }
        };

        const parseMusicXml = (xmlStr: string) => {
          const parser = new DOMParser();
          const dom = parser.parseFromString(xmlStr, "application/xml");
          const partElements = dom.getElementsByTagName("part");
          if (partElements.length === 0) {
            throw new Error("part element does not exist.");
          }
          // TODO: UIで読み込むパートを選択できるようにする
          parsePart(partElements[0]);
        };

        parseMusicXml(xmlStr);

        tempos.splice(1, tempos.length - 1); // TODO: 複数テンポに対応したら削除
        timeSignatures.splice(1, timeSignatures.length - 1); // TODO: 複数拍子に対応したら削除

        await dispatch("SET_SCORE", {
          score: {
            tpqn,
            tempos,
            timeSignatures,
            notes,
          },
        });
      }
    ),
  },

  SET_NOW_AUDIO_EXPORTING: {
    mutation(state, { nowAudioExporting }) {
      state.nowAudioExporting = nowAudioExporting;
    },
  },

  SET_CANCELLATION_OF_AUDIO_EXPORT_REQUESTED: {
    mutation(state, { cancellationOfAudioExportRequested }) {
      state.cancellationOfAudioExportRequested =
        cancellationOfAudioExportRequested;
    },
  },

  EXPORT_WAVE_FILE: {
    action: createUILockAction(
      async ({ state, getters, commit, dispatch }, { filePath }) => {
        const convertToWavFileData = (audioBuffer: AudioBuffer) => {
          const bytesPerSample = 4; // Float32
          const formatCode = 3; // WAVE_FORMAT_IEEE_FLOAT

          const numberOfChannels = audioBuffer.numberOfChannels;
          const numberOfSamples = audioBuffer.length;
          const sampleRate = audioBuffer.sampleRate;
          const byteRate = sampleRate * numberOfChannels * bytesPerSample;
          const blockSize = numberOfChannels * bytesPerSample;
          const dataSize = numberOfSamples * numberOfChannels * bytesPerSample;

          const buffer = new ArrayBuffer(44 + dataSize);
          const dataView = new DataView(buffer);

          let pos = 0;
          const writeString = (value: string) => {
            for (let i = 0; i < value.length; i++) {
              dataView.setUint8(pos, value.charCodeAt(i));
              pos += 1;
            }
          };
          const writeUint32 = (value: number) => {
            dataView.setUint32(pos, value, true);
            pos += 4;
          };
          const writeUint16 = (value: number) => {
            dataView.setUint16(pos, value, true);
            pos += 2;
          };
          const writeSample = (offset: number, value: number) => {
            dataView.setFloat32(pos + offset * 4, value, true);
          };

          writeString("RIFF");
          writeUint32(36 + dataSize); // RIFFチャンクサイズ
          writeString("WAVE");
          writeString("fmt ");
          writeUint32(16); // fmtチャンクサイズ
          writeUint16(formatCode);
          writeUint16(numberOfChannels);
          writeUint32(sampleRate);
          writeUint32(byteRate);
          writeUint16(blockSize);
          writeUint16(bytesPerSample * 8); // 1サンプルあたりのビット数
          writeString("data");
          writeUint32(dataSize);

          for (let i = 0; i < numberOfChannels; i++) {
            const channelData = audioBuffer.getChannelData(i);
            for (let j = 0; j < numberOfSamples; j++) {
              writeSample(j * numberOfChannels + i, channelData[j]);
            }
          }

          return buffer;
        };

        const generateWriteErrorMessage = (writeFileResult: ResultError) => {
          if (writeFileResult.code) {
            const code = writeFileResult.code.toUpperCase();

            if (code.startsWith("ENOSPC")) {
              return "空き容量が足りません。";
            }

            if (code.startsWith("EACCES")) {
              return "ファイルにアクセスする許可がありません。";
            }

            if (code.startsWith("EBUSY")) {
              return "ファイルが開かれています。";
            }
          }

          return `何らかの理由で失敗しました。${writeFileResult.message}`;
        };

        const calcRenderDuration = () => {
          const notes = state.score.notes;
          if (notes.length === 0) {
            return 1;
          }
          const lastNote = notes[notes.length - 1];
          const lastNoteEndPosition = lastNote.position + lastNote.duration;
          const lastNoteEndTime = getters.TICK_TO_SECOND(lastNoteEndPosition);
          return Math.max(1, lastNoteEndTime + 1);
        };

        const exportWaveFile = async (): Promise<SaveResultObject> => {
          const fileName = "test_export.wav"; // TODO: 設定できるようにする
          const numberOfChannels = 2;
          const sampleRate = 48000; // TODO: 設定できるようにする
          const withLimiter = false; // TODO: 設定できるようにする

          const renderDuration = calcRenderDuration();

          if (state.nowPlaying) {
            await dispatch("SING_STOP_AUDIO");
          }

          if (state.savingSetting.fixedExportEnabled) {
            filePath = path.join(state.savingSetting.fixedExportDir, fileName);
          } else {
            filePath ??= await window.electron.showAudioSaveDialog({
              title: "音声を保存",
              defaultPath: fileName,
            });
          }
          if (!filePath) {
            return { result: "CANCELED", path: "" };
          }

          if (state.savingSetting.avoidOverwrite) {
            let tail = 1;
            const name = filePath.slice(0, filePath.length - 4);
            while (await window.electron.checkFileExists(filePath)) {
              filePath = name + "[" + tail.toString() + "]" + ".wav";
              tail += 1;
            }
          }

          if (state.nowRendering) {
            await createPromiseThatResolvesWhen(() => {
              return (
                !state.nowRendering || state.cancellationOfAudioExportRequested
              );
            });
            if (state.cancellationOfAudioExportRequested) {
              return { result: "CANCELED", path: "" };
            }
          }

          const offlineAudioContext = new OfflineAudioContext(
            numberOfChannels,
            sampleRate * renderDuration,
            sampleRate
          );
          const offlineTransport = new OfflineTransport();
          const channelStrip = new ChannelStrip(offlineAudioContext);
          const limiter = withLimiter
            ? new Limiter(offlineAudioContext)
            : undefined;
          const clipper = new Clipper(offlineAudioContext);

          for (const [key, phrase] of Object.entries(state.phrases)) {
            const phraseData = phraseDataMap.get(key);
            if (!phraseData) {
              throw new Error("phraseData is undefined");
            }
            if (
              !phraseData.blob ||
              phrase.startTime === undefined ||
              phrase.state !== "PLAYABLE"
            ) {
              continue;
            }
            // TODO: この辺りの処理を共通化する
            const audioEvents = await generateAudioEvents(
              offlineAudioContext,
              phrase.startTime,
              phraseData.blob
            );
            const audioPlayer = new AudioPlayer(offlineAudioContext);
            audioPlayer.output.connect(channelStrip.input);
            const audioSequence: AudioSequence = {
              type: "audio",
              audioPlayer,
              audioEvents,
            };
            offlineTransport.addSequence(audioSequence);
          }
          channelStrip.volume = 1;
          if (limiter) {
            channelStrip.output.connect(limiter.input);
            limiter.output.connect(clipper.input);
          } else {
            channelStrip.output.connect(clipper.input);
          }
          clipper.output.connect(offlineAudioContext.destination);

          // スケジューリングを行い、オフラインレンダリングを実行
          // TODO: オフラインレンダリング後にメモリーがきちんと開放されるか確認する
          offlineTransport.schedule(0, renderDuration);
          const audioBuffer = await offlineAudioContext.startRendering();
          const waveFileData = convertToWavFileData(audioBuffer);

          try {
            await window.electron
              .writeFile({
                filePath,
                buffer: waveFileData,
              })
              .then(getValueOrThrow);
          } catch (e) {
            window.electron.logError(e);
            if (e instanceof ResultError) {
              return {
                result: "WRITE_ERROR",
                path: filePath,
                errorMessage: generateWriteErrorMessage(e),
              };
            }
            return {
              result: "UNKNOWN_ERROR",
              path: filePath,
              errorMessage:
                (e instanceof Error ? e.message : String(e)) ||
                "不明なエラーが発生しました。",
            };
          }

          return { result: "SUCCESS", path: filePath };
        };

        commit("SET_NOW_AUDIO_EXPORTING", { nowAudioExporting: true });
        return exportWaveFile().finally(() => {
          commit("SET_CANCELLATION_OF_AUDIO_EXPORT_REQUESTED", {
            cancellationOfAudioExportRequested: false,
          });
          commit("SET_NOW_AUDIO_EXPORTING", { nowAudioExporting: false });
        });
      }
    ),
  },

  CANCEL_AUDIO_EXPORT: {
    async action({ state, commit, dispatch }) {
      if (!state.nowAudioExporting) {
        dispatch("LOG_WARN", "CANCEL_AUDIO_EXPORT on !nowAudioExporting");
        return;
      }
      commit("SET_CANCELLATION_OF_AUDIO_EXPORT_REQUESTED", {
        cancellationOfAudioExportRequested: true,
      });
    },
  },
});
