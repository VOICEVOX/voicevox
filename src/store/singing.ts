import {
  AudioEvent,
  AudioPlayer,
  AudioRenderer,
  AudioSequence,
  Context,
  NoteEvent,
  NoteSequence,
  SoundSequence,
  Synth,
  Transport,
} from "@/infrastructures/AudioRenderer";
import {
  Score,
  Tempo,
  TimeSignature,
  Note,
  SingingStoreState,
  SingingStoreTypes,
  SaveResultObject,
} from "./type";
import path from "path";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import { WriteFileErrorResult } from "@/type/preload";
import { Midi } from "@tonejs/midi";
import {
  getDoremiFromMidi,
  midiToFrequency,
  round,
} from "@/helpers/singHelper";
import { AudioQuery } from "@/openapi";

const ticksToSecondsForConstantBpm = (
  resolution: number,
  bpm: number,
  ticks: number
) => {
  const ticksPerBeat = resolution;
  const beatsPerSecond = bpm / 60;
  return ticks / ticksPerBeat / beatsPerSecond;
};

const secondsToTickForConstantBpm = (
  resolution: number,
  bpm: number,
  seconds: number
) => {
  const ticksPerBeat = resolution;
  const beatsPerSecond = bpm / 60;
  return seconds * beatsPerSecond * ticksPerBeat;
};

const ticksToSeconds = (resolution: number, tempos: Tempo[], ticks: number) => {
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
    timeOfTempo += ticksToSecondsForConstantBpm(
      resolution,
      tempos[i].tempo,
      tempos[i + 1].position - tempos[i].position
    );
  }
  return (
    timeOfTempo +
    ticksToSecondsForConstantBpm(
      resolution,
      tempo.tempo,
      ticks - tempo.position
    )
  );
};

const secondsToTicks = (
  resolution: number,
  tempos: Tempo[],
  seconds: number
) => {
  let timeOfTempo = 0;
  let tempo = tempos[tempos.length - 1];
  for (let i = 0; i < tempos.length; i++) {
    if (i === tempos.length - 1) {
      break;
    }
    const timeOfNextTempo =
      timeOfTempo +
      ticksToSecondsForConstantBpm(
        resolution,
        tempos[i].tempo,
        tempos[i + 1].position - tempos[i].position
      );
    if (timeOfNextTempo > seconds) {
      tempo = tempos[i];
      break;
    }
    timeOfTempo = timeOfNextTempo;
  }
  return (
    tempo.position +
    secondsToTickForConstantBpm(resolution, tempo.tempo, seconds - timeOfTempo)
  );
};

const generateNoteEvents = (
  resolution: number,
  tempos: Tempo[],
  notes: Note[]
) => {
  return notes.map((value): NoteEvent => {
    const noteOnPos = value.position;
    const noteOffPos = value.position + value.duration;
    return {
      midi: value.midi,
      noteOnTime: ticksToSeconds(resolution, tempos, noteOnPos),
      noteOffTime: ticksToSeconds(resolution, tempos, noteOffPos),
    };
  });
};

const copyScore = (score: Score): Score => {
  return {
    resolution: score.resolution,
    tempos: score.tempos.map((value) => ({ ...value })),
    timeSignatures: score.timeSignatures.map((value) => ({ ...value })),
    notes: score.notes.map((value) => ({ ...value })),
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

type Singer = {
  readonly engineId: string;
  readonly styleId: number;
};

type Phrase = {
  readonly singer: Singer | undefined;
  readonly score: Score;
  // renderingが進むに連れてデータが代入されていく
  query?: AudioQuery;
  queryHash?: string; // queryの変更を検知するためのハッシュ
  buffer?: AudioBuffer;
  startTime?: number;
};

const generateSingerAndScoreHash = async (obj: {
  singer: Singer | undefined;
  score: Score;
}) => {
  return _generateHash(obj);
};

const generateAudioQueryHash = async (obj: AudioQuery) => {
  return _generateHash(obj);
};

type ChannelOptions = {
  readonly volume: number;
};

class SingChannel {
  private readonly context: Context;
  private readonly gainNode: GainNode;

  private phrases: Phrase[] = [];
  private sequences: SoundSequence[] = [];

  get volume() {
    return this.gainNode.gain.value;
  }

  set volume(value: number) {
    this.gainNode.gain.value = value;
  }

  constructor(context: Context, options: ChannelOptions = { volume: 0.1 }) {
    this.context = context;
    const audioContext = context.audioContext;

    this.gainNode = audioContext.createGain();
    this.gainNode.connect(audioContext.destination);
    this.gainNode.gain.value = options.volume;
  }

  addPhrase(phrase: Phrase) {
    this.phrases.push(phrase);

    let sequence: SoundSequence | undefined;
    if (phrase.startTime !== undefined && phrase.buffer) {
      const audioEvents: AudioEvent[] = [
        {
          time: phrase.startTime,
          buffer: phrase.buffer,
        },
      ];
      const audioPlayer = new AudioPlayer(this.context);
      audioPlayer.connect(this.gainNode);
      sequence = new AudioSequence(audioPlayer, audioEvents);
    } else {
      const noteEvents = generateNoteEvents(
        phrase.score.resolution,
        phrase.score.tempos,
        phrase.score.notes
      );
      const synth = new Synth(this.context);
      synth.connect(this.gainNode);
      sequence = new NoteSequence(synth, noteEvents);
    }

    this.context.transport.addSequence(sequence);
    this.sequences.push(sequence);
  }

  removePhrase(phrase: Phrase) {
    const index = this.phrases.findIndex((value) => {
      return value === phrase;
    });
    if (index === -1) {
      throw new Error("The specified phrase does not exist.");
    }
    this.phrases.splice(index, 1);

    const sequence = this.sequences[index];
    this.context.transport.removeSequence(sequence);
    this.sequences.splice(index, 1);
  }

  dispose() {
    this.sequences.forEach((value) => {
      this.context.transport.removeSequence(value);
    });
  }
}

const isValidTempo = (tempo: Tempo) => {
  return (
    Number.isInteger(tempo.position) &&
    Number.isFinite(tempo.tempo) &&
    tempo.position >= 0 &&
    tempo.tempo > 0
  );
};

const isValidTimeSignature = (timeSignature: TimeSignature) => {
  return (
    Number.isInteger(timeSignature.position) &&
    Number.isInteger(timeSignature.beats) &&
    Number.isInteger(timeSignature.beatType) &&
    timeSignature.position >= 0 &&
    timeSignature.beats > 0 &&
    timeSignature.beatType > 0
  );
};

const isValidNote = (note: Note) => {
  return (
    Number.isInteger(note.position) &&
    Number.isInteger(note.duration) &&
    Number.isInteger(note.midi) &&
    note.position >= 0 &&
    note.duration > 0 &&
    note.midi >= 0 &&
    note.midi <= 127
  );
};

const getFromOptional = <T>(value: T | undefined): T => {
  if (value === undefined) {
    throw new Error("The value is undefined.");
  }
  return value;
};

const DEFAULT_RESOLUTION = 480;
const DEFAULT_TEMPO = 120;
const DEFAULT_BEATS = 4;
const DEFAULT_BEAT_TYPE = 4;

let audioRenderer: AudioRenderer | undefined;
let transport: Transport | undefined;
let singChannel: SingChannel | undefined;

// テスト時はAudioContextが存在しないのでAudioRendererを作らない
if (window.AudioContext) {
  audioRenderer = new AudioRenderer();
  transport = audioRenderer.transport;
  singChannel = new SingChannel(audioRenderer.context);
}

let playbackPosition = 0;
const allPhrases = new Map<string, Phrase>();

const audioBufferCache = new Map<string, AudioBuffer>();

export const singingStoreState: SingingStoreState = {
  engineId: undefined,
  styleId: undefined,
  score: undefined,
  // NOTE: UIの状態は試行のためsinging.tsに局所化する+Hydrateが必要
  isShowSinger: true,
  sequencerZoomX: 0.5,
  sequencerZoomY: 0.5,
  sequencerScrollY: 60, // Y軸 midi number
  sequencerScrollX: 0, // X軸 midi duration(仮)
  sequencerSnapSize: 120, // スナップサイズ 試行用で1/16(ppq=480)のmidi durationで固定
  nowPlaying: false,
  volume: 0,
  leftLocatorPosition: 0,
  rightLocatorPosition: 0,
  renderingEnabled: false,
  startRenderingRequested: false,
  stopRenderingRequested: false,
  nowRendering: false,
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
    mutation(
      state,
      { engineId, styleId }: { engineId: string; styleId: number }
    ) {
      state.engineId = engineId;
      state.styleId = styleId;
    },
    async action({ state, getters, dispatch, commit }, payload) {
      if (state.defaultStyleIds == undefined)
        throw new Error("state.defaultStyleIds == undefined");
      if (getters.USER_ORDERED_CHARACTER_INFOS == undefined)
        throw new Error("state.characterInfos == undefined");
      const userOrderedCharacterInfos = getters.USER_ORDERED_CHARACTER_INFOS;

      const engineId = payload.engineId ?? state.engineIds[0];

      // FIXME: engineIdも含めて探査する
      const styleId =
        payload.styleId ??
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
        commit("SET_SINGER", { engineId, styleId });

        dispatch("RENDER");
      }
    },
  },

  GET_EMPTY_SCORE: {
    async action() {
      const score = {
        resolution: DEFAULT_RESOLUTION,
        tempos: [{ position: 0, tempo: DEFAULT_TEMPO }],
        timeSignatures: [
          { position: 0, beats: DEFAULT_BEATS, beatType: DEFAULT_BEAT_TYPE },
        ],
        notes: [],
      };
      if (score.tempos.length !== 1 || score.tempos[0].position !== 0) {
        throw new Error("Tempo does not exist at the beginning of the score.");
      }
      if (
        score.timeSignatures.length !== 1 ||
        score.timeSignatures[0].position !== 0
      ) {
        throw new Error(
          "Time signature does not exist at the beginning of the score."
        );
      }
      return score;
    },
  },

  SET_SCORE: {
    mutation(state, { score }: { score: Score }) {
      state.score = score;
    },
    async action({ state, getters, commit, dispatch }, { score }) {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        await dispatch("SING_STOP_AUDIO");
      }
      commit("SET_SCORE", { score });

      transport.time = getters.POSITION_TO_TIME(playbackPosition);

      dispatch("RENDER");
    },
  },

  SET_TEMPO: {
    mutation(state, { index, tempo }: { index: number; tempo: Tempo }) {
      const score = getFromOptional(state.score);
      const tempos = [...score.tempos];
      tempos.splice(index, 0, tempo);
      score.tempos = tempos;
    },
    // テンポを設定する。既に同じ位置にテンポが存在する場合は置き換える。
    async action({ state, getters, commit, dispatch }, { tempo }) {
      const score = state.score;
      if (score === undefined || score.tempos.length === 0) {
        throw new Error("Score is not initialized.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (!isValidTempo(tempo)) {
        throw new Error("The tempo is invalid.");
      }
      const duplicate = score.tempos.some((value) => {
        return value.position === tempo.position;
      });
      const index = score.tempos.findIndex((value) => {
        return value.position >= tempo.position;
      });
      if (index === -1) return;

      tempo.tempo = round(tempo.tempo, 2);

      if (state.nowPlaying) {
        playbackPosition = getters.TIME_TO_POSITION(transport.time);
      }

      if (duplicate) {
        commit("REMOVE_TEMPO", { index });
      }
      commit("SET_TEMPO", { index, tempo });

      transport.time = getters.POSITION_TO_TIME(playbackPosition);

      dispatch("RENDER");
    },
  },

  REMOVE_TEMPO: {
    mutation(state, { index }: { index: number }) {
      const score = getFromOptional(state.score);
      const tempos = [...score.tempos];
      tempos.splice(index, 1);
      score.tempos = tempos;
    },
    // テンポを削除する。先頭のテンポの場合はデフォルトのテンポに置き換える。
    async action({ state, getters, commit, dispatch }, { position }) {
      const emptyScore = await dispatch("GET_EMPTY_SCORE");
      const defaultTempo = emptyScore.tempos[0];

      const score = state.score;
      if (score === undefined || score.tempos.length === 0) {
        throw new Error("Score is not initialized.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      const index = score.tempos.findIndex((value) => {
        return value.position === position;
      });
      if (index === -1) return;

      if (state.nowPlaying) {
        playbackPosition = getters.TIME_TO_POSITION(transport.time);
      }

      commit("REMOVE_TEMPO", { index });
      if (index === 0) {
        commit("SET_TEMPO", { index, tempo: defaultTempo });
      }

      transport.time = getters.POSITION_TO_TIME(playbackPosition);

      dispatch("RENDER");
    },
  },

  SET_TIME_SIGNATURE: {
    mutation(
      state,
      { index, timeSignature }: { index: number; timeSignature: TimeSignature }
    ) {
      const score = getFromOptional(state.score);
      const timeSignatures = [...score.timeSignatures];
      timeSignatures.splice(index, 0, timeSignature);
      score.timeSignatures = timeSignatures;
    },
    // 拍子を設定する。既に同じ位置に拍子が存在する場合は置き換える。
    async action(
      { state, commit },
      { timeSignature }: { timeSignature: TimeSignature }
    ) {
      const score = state.score;
      if (score === undefined || score.timeSignatures.length === 0) {
        throw new Error("Score is not initialized.");
      }
      if (!isValidTimeSignature(timeSignature)) {
        throw new Error("The time signature is invalid.");
      }
      const duplicate = score.timeSignatures.some((value) => {
        return value.position === timeSignature.position;
      });
      const index = score.timeSignatures.findIndex((value) => {
        return value.position >= timeSignature.position;
      });
      if (index === -1) return;

      if (duplicate) {
        commit("REMOVE_TIME_SIGNATURE", { index });
      }
      commit("SET_TIME_SIGNATURE", { index, timeSignature });
    },
  },

  REMOVE_TIME_SIGNATURE: {
    mutation(state, { index }: { index: number }) {
      const score = getFromOptional(state.score);
      const timeSignatures = [...score.timeSignatures];
      timeSignatures.splice(index, 1);
      score.timeSignatures = timeSignatures;
    },
    // 拍子を削除する。先頭の拍子の場合はデフォルトの拍子に置き換える。
    async action({ state, commit, dispatch }, { position }) {
      const emptyScore = await dispatch("GET_EMPTY_SCORE");
      const defaultTimeSignature = emptyScore.timeSignatures[0];

      const score = state.score;
      if (score === undefined || score.timeSignatures.length === 0) {
        throw new Error("Score is not initialized.");
      }
      const index = score.timeSignatures.findIndex((value) => {
        return value.position === position;
      });
      if (index === -1) return;

      commit("REMOVE_TIME_SIGNATURE", { index });
      if (index === 0) {
        commit("SET_TIME_SIGNATURE", {
          index,
          timeSignature: defaultTimeSignature,
        });
      }
    },
  },

  ADD_NOTE: {
    mutation(state, { note }: { note: Note }) {
      if (state.score) {
        const notes = state.score.notes.concat(note).sort((a, b) => {
          return a.position - b.position;
        });
        state.score.notes = notes;
      }
    },
    // ノートを追加する
    // NOTE: 重複削除など別途追加
    async action({ state, commit, dispatch }, { note }) {
      if (state.score === undefined) {
        throw new Error("Score is not initialized.");
      }
      if (!isValidNote(note)) {
        throw new Error("The note is invalid.");
      }
      commit("ADD_NOTE", { note });

      dispatch("RENDER");
    },
  },

  CHANGE_NOTE: {
    mutation(state, { index, note }: { index: number; note: Note }) {
      if (state.score) {
        const notes = [...state.score.notes];
        notes.splice(index, 1, note);
        state.score.notes = notes;
      }
    },
    async action({ state, commit, dispatch }, { index, note }) {
      if (state.score === undefined) {
        throw new Error("Score is not initialized.");
      }
      if (!isValidNote(note)) {
        throw new Error("The note is invalid.");
      }
      commit("CHANGE_NOTE", { index, note });

      dispatch("RENDER");
    },
  },

  REMOVE_NOTE: {
    mutation(state, { index }: { index: number }) {
      if (state.score) {
        const notes = [...state.score.notes];
        notes.splice(index, 1);
        state.score.notes = notes;
      }
    },
    async action({ state, commit, dispatch }, { index }) {
      if (state.score === undefined) {
        throw new Error("Score is not initialized.");
      }
      commit("REMOVE_NOTE", { index });

      dispatch("RENDER");
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

  SET_SCROLL_X: {
    mutation(state, { scrollX }: { scrollX: number }) {
      state.sequencerScrollX = scrollX;
    },
    async action({ commit }, { scrollX }) {
      commit("SET_SCROLL_X", {
        scrollX,
      });
    },
  },

  SET_SCROLL_Y: {
    mutation(state, { scrollY }: { scrollY: number }) {
      state.sequencerScrollY = scrollY;
    },
    async action({ commit }, { scrollY }) {
      commit("SET_SCROLL_Y", {
        scrollY,
      });
    },
  },
  POSITION_TO_TIME: {
    getter: (state) => (position) => {
      const score = getFromOptional(state.score);
      return ticksToSeconds(score.resolution, score.tempos, position);
    },
  },
  TIME_TO_POSITION: {
    getter: (state) => (time) => {
      const score = getFromOptional(state.score);
      return secondsToTicks(score.resolution, score.tempos, time);
    },
  },
  GET_PLAYBACK_POSITION: {
    getter: (state, getters) => () => {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        playbackPosition = getters.TIME_TO_POSITION(transport.time);
      }
      return playbackPosition;
    },
  },

  SET_PLAYBACK_POSITION: {
    async action({ getters }, { position }) {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      playbackPosition = position;

      transport.time = getters.POSITION_TO_TIME(position);
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
    async action({ commit }) {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      commit("SET_PLAYBACK_STATE", { nowPlaying: true });

      transport.start();
    },
  },

  SING_STOP_AUDIO: {
    async action({ commit }) {
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      commit("SET_PLAYBACK_STATE", { nowPlaying: false });

      transport.stop();
    },
  },

  SET_VOLUME: {
    mutation(state, { volume }) {
      state.volume = volume;
    },
    async action({ commit }, { volume }) {
      if (!singChannel) {
        throw new Error("singChannel is undefined.");
      }
      commit("SET_VOLUME", { volume });

      singChannel.volume = volume;
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
      const preProcessing = (score: Score) => {
        const resolution = score.resolution;
        const tempos = score.tempos;
        const notes = score.notes;

        // 重複するノートを除く
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          if (i === 0) continue;
          const lastNote = notes[i - 1];
          if (note.position < lastNote.position + lastNote.duration) {
            notes.splice(i, 1);
            i--;
          }
        }

        // 長いノートを短くする
        const maxNoteTime = 0.26;
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          const noteOnPos = note.position;
          const noteOffPos = note.position + note.duration;
          const noteOnTime = ticksToSeconds(resolution, tempos, noteOnPos);
          const noteOffTime = ticksToSeconds(resolution, tempos, noteOffPos);

          if (noteOffTime - noteOnTime > maxNoteTime) {
            let noteOffPos = secondsToTicks(
              resolution,
              tempos,
              noteOnTime + maxNoteTime
            );
            noteOffPos = Math.max(note.position + 1, Math.floor(noteOffPos));
            note.duration = noteOffPos - note.position;
          }
        }
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
            const hash = await generateSingerAndScoreHash({
              singer,
              score: phraseScore, // NOTE: とりあえず拍子も含めてハッシュ生成する
            });
            foundPhrases.set(hash, {
              singer,
              score: phraseScore,
            });

            phraseNotes = [];
          }
        }
        return foundPhrases;
      };

      const generateAndEditQuery = async (singer: Singer, score: Score) => {
        if (!getters.IS_ENGINE_READY(singer.engineId)) {
          throw new Error("Engine not ready.");
        }

        const text = score.notes
          .map((value) => value.lyric)
          .map((value) => value.replace("は", "ハ")) // TODO: 助詞の扱いはあとで考える
          .map((value) => value.replace("へ", "ヘ")) // TODO: 助詞の扱いはあとで考える
          .join("");

        const query = await dispatch("FETCH_AUDIO_QUERY", {
          text,
          engineId: singer.engineId,
          styleId: singer.styleId,
        });

        const moras = query.accentPhrases.map((value) => value.moras).flat();

        if (moras.length !== score.notes.length) {
          throw new Error(
            "The number of moras and the number of notes do not match."
          );
        }

        // 音素を表示
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

        // クエリを編集
        let noteIndex = 0;
        for (let i = 0; i < query.accentPhrases.length; i++) {
          const accentPhrase = query.accentPhrases[i];
          const moras = accentPhrase.moras;
          for (let j = 0; j < moras.length; j++) {
            const mora = moras[j];
            const note = score.notes[noteIndex];

            const noteOnTime = ticksToSeconds(
              score.resolution,
              score.tempos,
              note.position
            );
            const noteOffTime = ticksToSeconds(
              score.resolution,
              score.tempos,
              note.position + note.duration
            );

            // 長さを編集
            let vowelLength = noteOffTime - noteOnTime;
            if (j !== moras.length - 1) {
              const nextMora = moras[j + 1];
              if (nextMora.consonantLength !== undefined) {
                vowelLength -= nextMora.consonantLength;
              }
            } else if (i !== query.accentPhrases.length - 1) {
              const nextAccentPhrase = query.accentPhrases[i + 1];
              const nextMora = nextAccentPhrase.moras[0];
              if (nextMora.consonantLength !== undefined) {
                vowelLength -= nextMora.consonantLength;
              }
            }
            mora.vowelLength = Math.max(0.001, vowelLength);

            // 音高を編集
            const freq = midiToFrequency(note.midi);
            mora.pitch = Math.log(freq);

            noteIndex++;
          }
        }

        return query;
      };

      const calculateStartTime = (score: Score, query: AudioQuery) => {
        const firstMora = query.accentPhrases[0].moras[0];
        let startTime = ticksToSeconds(
          score.resolution,
          score.tempos,
          score.notes[0].position
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

      const getSinger = (): Singer | undefined => {
        if (state.engineId === undefined || state.styleId === undefined) {
          return undefined;
        }
        return { engineId: state.engineId, styleId: state.styleId };
      };

      // NOTE: 型推論でawaitの前か後かが考慮されないので、関数を介して取得する（型がbooleanになるようにする）
      const startRenderingRequested = () => state.startRenderingRequested;
      const stopRenderingRequested = () => state.stopRenderingRequested;

      const render = async () => {
        if (!state.score || !singChannel || !audioRenderer) {
          throw new Error(
            "score or singChannel or audioRenderer is undefined."
          );
        }
        const singChannelRef = singChannel;
        const audioRendererRef = audioRenderer;

        // レンダリング中に変更される可能性のあるデータをコピーする
        const score = copyScore(state.score);
        const singer = getSinger();

        preProcessing(score);

        // Score -> Phrases

        window.electron.logInfo("Updating phrases...");

        const foundPhrases = await searchPhrases(singer, score);
        for (const [hash, phrase] of foundPhrases) {
          if (!allPhrases.has(hash)) {
            allPhrases.set(hash, phrase);
            singChannelRef.addPhrase(phrase);
          }
        }
        for (const [hash, phrase] of allPhrases) {
          if (!foundPhrases.has(hash)) {
            allPhrases.delete(hash);
            singChannelRef.removePhrase(phrase);
          }
        }

        window.electron.logInfo("Phrases updated.");

        if (startRenderingRequested() || stopRenderingRequested()) {
          return;
        }

        for (const phrase of allPhrases.values()) {
          if (!phrase.singer) {
            continue;
          }

          // Phrase -> AudioQuery

          if (!phrase.query) {
            window.electron.logInfo(`Generating query...`);

            phrase.query = await generateAndEditQuery(
              phrase.singer,
              phrase.score
            );

            window.electron.logInfo(`Query generated.`);
          }

          if (startRenderingRequested() || stopRenderingRequested()) {
            return;
          }

          // AudioQuery -> AudioBuffer
          // Phrase & AudioQuery -> startTime

          const queryHash = await generateAudioQueryHash(phrase.query);
          // クエリが変更されていたら再合成
          if (queryHash !== phrase.queryHash) {
            phrase.buffer = audioBufferCache.get(queryHash);
            if (phrase.buffer) {
              window.electron.logInfo(`Loaded audio buffer from cache.`);
            } else {
              window.electron.logInfo(`Synthesizing...`);

              const blob = await synthesize(phrase.singer, phrase.query);
              phrase.buffer = await audioRendererRef.createAudioBuffer(blob);
              audioBufferCache.set(queryHash, phrase.buffer);

              window.electron.logInfo(`Synthesized.`);
            }
            phrase.queryHash = queryHash;
            phrase.startTime = calculateStartTime(phrase.score, phrase.query);

            // NoteSequenceが削除される
            singChannelRef.removePhrase(phrase);
            // AudioBufferとstartTimeを元にAudioSequenceが作成され、追加される
            // TODO: 分かりにくいのでリファクタリングする
            singChannelRef.addPhrase(phrase);
          }

          if (startRenderingRequested() || stopRenderingRequested()) {
            return;
          }
        }
      };

      commit("SET_START_RENDERING_REQUESTED", {
        startRenderingRequested: true,
      });
      if (!state.renderingEnabled || state.nowRendering) {
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

  SET_RENDERING_ENABLED: {
    mutation(state, { renderingEnabled }) {
      state.renderingEnabled = renderingEnabled;
    },
    async action({ commit, dispatch }, { renderingEnabled }) {
      if (renderingEnabled) {
        dispatch("RENDER");
      } else {
        await dispatch("STOP_RENDERING");
      }
      commit("SET_RENDERING_ENABLED", { renderingEnabled });
    },
  },

  IMPORT_MIDI_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        if (!filePath) {
          filePath = await window.electron.showImportFileDialog({
            title: "MIDI読み込み",
            name: "MIDI",
            extensions: ["mid", "midi"],
          });
          if (!filePath) return;
        }

        const midiData = await window.electron.readFile({ filePath });
        const midi = new Midi(midiData);

        const score = await dispatch("GET_EMPTY_SCORE");

        const convertToPosBasedOnRes = (position: number) => {
          return Math.round(position * (score.resolution / midi.header.ppq));
        };

        const convertToDurationBasedOnRes = (
          position: number,
          duration: number
        ) => {
          let endPosition = position + duration;
          endPosition = convertToPosBasedOnRes(endPosition);
          position = convertToPosBasedOnRes(position);
          return Math.max(0, endPosition - position);
        };

        // TODO: UIで読み込むトラックを選択できるようにする
        // ひとまず1トラック目のみを読み込む
        midi.tracks[0].notes
          .map((note) => ({
            position: convertToPosBasedOnRes(note.ticks),
            duration: convertToDurationBasedOnRes(
              note.ticks,
              note.durationTicks
            ),
            midi: note.midi,
            lyric: getDoremiFromMidi(note.midi),
          }))
          .sort((a, b) => a.position - b.position)
          .forEach((note) => {
            // ノートの重なりを考慮して、一番音が高いノート（トップノート）のみインポートする
            if (score.notes.length === 0) {
              score.notes.push(note);
              return;
            }
            const topNote = score.notes[score.notes.length - 1];
            const topNoteEnd = topNote.position + topNote.duration;
            if (note.position >= topNoteEnd) {
              score.notes.push(note);
              return;
            }
            if (note.midi > topNote.midi) {
              score.notes.pop();
              score.notes.push(note);
            }
          });

        const tempos = midi.header.tempos
          .map((tempo) => ({
            position: convertToPosBasedOnRes(tempo.ticks),
            tempo: round(tempo.bpm, 2),
          }))
          .sort((a, b) => a.position - b.position);

        score.tempos = score.tempos
          .concat(tempos)
          .filter((value, index, array) => {
            if (index === array.length - 1) return true;
            return value.position !== array[index + 1].position;
          });

        const timeSignatures = midi.header.timeSignatures
          .map((timeSignature) => ({
            position: convertToPosBasedOnRes(timeSignature.ticks),
            beats: timeSignature.timeSignature[0],
            beatType: timeSignature.timeSignature[1],
          }))
          .sort((a, b) => a.position - b.position);

        score.timeSignatures = score.timeSignatures
          .concat(timeSignatures)
          .filter((value, index, array) => {
            if (index === array.length - 1) return true;
            return value.position !== array[index + 1].position;
          });

        await dispatch("SET_SCORE", { score });
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
          await window.electron.readFile({ filePath })
        );
        if (xmlStr.indexOf("\ufffd") > -1) {
          xmlStr = new TextDecoder("shift-jis").decode(
            await window.electron.readFile({ filePath })
          );
        }

        const score = await dispatch("GET_EMPTY_SCORE");

        const getMeasureDuration = (beats: number, beatType: number) => {
          const referenceMeasureDuration = score.resolution * 4;
          return Math.round((referenceMeasureDuration * beats) / beatType);
        };

        let divisions = 1;
        let position = 0;
        let measurePosition = 0;
        let measureDuration = getMeasureDuration(
          score.timeSignatures[0].beats,
          score.timeSignatures[0].beatType
        );
        let tieStartNote: Note | null = null;

        const getChild = (element: Element | null, tagName: string) => {
          if (element === null) return null;
          for (const childElement of element.children) {
            if (childElement.tagName === tagName) {
              return childElement;
            }
          }
          return null;
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
          return Math.round((score.resolution * duration) / divisions);
        };

        const getTie = (elementThatMayBeTied: Element) => {
          let tie = false;
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
          if (!soundElement.hasAttribute("tempo")) return;
          if (score.tempos.length !== 0) {
            const lastTempo = score.tempos[score.tempos.length - 1];
            if (lastTempo.position === position) {
              score.tempos.pop();
            }
          }
          const tempo = getAttributeAsNumber(soundElement, "tempo");
          score.tempos.push({
            position: position,
            tempo: round(tempo, 2),
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
          if (beatsElement === null) {
            throw new Error("beats element does not exist.");
          }
          const beatTypeElement = getChild(timeElement, "beat-type");
          if (beatTypeElement === null) {
            throw new Error("beat-type element does not exist.");
          }
          const beats = getValueAsNumber(beatsElement);
          const beatType = getValueAsNumber(beatTypeElement);
          measureDuration = getMeasureDuration(beats, beatType);
          if (score.timeSignatures.length !== 0) {
            const lastTimeSignature =
              score.timeSignatures[score.timeSignatures.length - 1];
            if (lastTimeSignature.position === position) {
              score.timeSignatures.pop();
            }
          }
          score.timeSignatures.push({
            position: position,
            beats: beats,
            beatType: beatType,
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
          if (durationElement === null) {
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

          if (getChild(noteElement, "rest") !== null) {
            position += duration;
            return;
          }

          const pitchElement = getChild(noteElement, "pitch");
          if (pitchElement === null) {
            throw new Error("pitch element does not exist.");
          }
          const octaveElement = getChild(pitchElement, "octave");
          if (octaveElement === null) {
            throw new Error("octave element does not exist.");
          }
          const stepElement = getChild(pitchElement, "step");
          if (stepElement === null) {
            throw new Error("step element does not exist.");
          }
          const alterElement = getChild(pitchElement, "alter");

          const octave = getValueAsNumber(octaveElement);
          const stepNumber = getStepNumber(stepElement);
          let noteNumber = 12 * (octave + 1) + stepNumber;
          if (alterElement !== null) {
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

          const note = {
            position: position,
            duration: duration,
            midi: noteNumber,
            lyric: lyric,
          };

          if (tie) {
            if (tieStartNote === null) {
              tieStartNote = note;
            }
          } else {
            if (tieStartNote === null) {
              score.notes.push(note);
            } else {
              tieStartNote.duration = noteEnd - tieStartNote.position;
              score.notes.push(tieStartNote);
              tieStartNote = null;
            }
          }
          position += duration;
        };

        const parseMeasure = (measureElement: Element) => {
          measurePosition = position;
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
            tieStartNote = null;
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

        await dispatch("SET_SCORE", { score });
      }
    ),
  },

  EXPORT_WAVE_FILE: {
    action: createUILockAction(
      async (
        { state, getters, dispatch },
        { filePath }
      ): Promise<SaveResultObject> => {
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

        const generateWriteErrorMessage = (
          writeFileErrorResult: WriteFileErrorResult
        ) => {
          if (writeFileErrorResult.code) {
            const code = writeFileErrorResult.code.toUpperCase();
            if (code.startsWith("ENOSPC")) {
              return "空き容量が足りません。";
            }
            if (code.startsWith("EACCES")) {
              return "ファイルにアクセスする許可がありません。";
            }
          }
          return `何らかの理由で失敗しました。${writeFileErrorResult.message}`;
        };

        if (!audioRenderer) {
          throw new Error("audioRenderer is undefined.");
        }

        // TODO: ファイル名を設定できるようにする
        const fileName = "test_export.wav";

        const leftLocatorPos = state.leftLocatorPosition;
        const rightLocatorPos = state.rightLocatorPosition;
        const renderStartTime = getters.POSITION_TO_TIME(leftLocatorPos);
        const renderEndTime = getters.POSITION_TO_TIME(rightLocatorPos);
        const renderDuration = renderEndTime - renderStartTime;

        if (renderEndTime <= renderStartTime) {
          // TODO: メッセージを表示するようにする
          throw new Error("Invalid render range.");
        }

        if (state.nowPlaying) {
          await dispatch("SING_STOP_AUDIO");
        }
        if (state.nowRendering) {
          await dispatch("STOP_RENDERING");
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
          while (await dispatch("CHECK_FILE_EXISTS", { file: filePath })) {
            filePath = name + "[" + tail.toString() + "]" + ".wav";
            tail += 1;
          }
        }

        // TODO: レンダリングで使用したノードはdisconnectしなくても解放されるはずですが、
        // 念のため歌声合成周りを実装後に確認した方が良いかも
        const audioBuffer = await audioRenderer.renderToBuffer(
          48000, // TODO: 設定できるようにする
          renderStartTime,
          renderDuration,
          (context) => {
            // SingChannelインスタンスはこの関数を抜けると解放されますが、
            // コンテキストにはノードや発音が登録されているので問題なくレンダリングされます
            // TODO: 分かりにくいので後でリファクタリングしたい
            const channel = new SingChannel(context);
            allPhrases.forEach((value) => channel.addPhrase(value));
          }
        );
        const waveFileData = convertToWavFileData(audioBuffer);

        const writeFileResult = window.electron.writeFile({
          filePath,
          buffer: waveFileData,
        }); // 失敗した場合、WriteFileErrorResultオブジェクトが返り、成功時はundefinedが反る
        if (writeFileResult) {
          window.electron.logError(new Error(writeFileResult.message));
          return {
            result: "WRITE_ERROR",
            path: filePath,
            errorMessage: generateWriteErrorMessage(writeFileResult),
          };
        }

        return { result: "SUCCESS", path: filePath };
      }
    ),
  },
});
