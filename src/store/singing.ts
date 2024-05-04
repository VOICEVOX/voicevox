import path from "path";
import { v4 as uuidv4 } from "uuid";
import { toRaw } from "vue";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import {
  Score,
  Tempo,
  TimeSignature,
  Note,
  SingingStoreState,
  SingingStoreTypes,
  SingingCommandStoreState,
  SingingCommandStoreTypes,
  SaveResultObject,
  Singer,
  Phrase,
  PhraseState,
  transformCommandStore,
  SingingGuide,
  SingingVoice,
  SingingGuideSourceHash,
  SingingVoiceSourceHash,
  SequencerEditTarget,
} from "./type";
import { sanitizeFileName } from "./utility";
import { EngineId, NoteId, StyleId } from "@/type/preload";
import { Midi } from "@/sing/midi";
import { FrameAudioQuery, Note as NoteForRequestToEngine } from "@/openapi";
import { ResultError, getValueOrThrow } from "@/type/result";
import {
  AudioEvent,
  AudioPlayer,
  AudioSequence,
  ChannelStrip,
  Clipper,
  Limiter,
  NoteEvent,
  NoteSequence,
  OfflineTransport,
  PolySynth,
  Sequence,
  Transport,
} from "@/sing/audioRendering";
import {
  selectPriorPhrase,
  getMeasureDuration,
  getNoteDuration,
  isValidNote,
  isValidScore,
  isValidSnapType,
  isValidTempo,
  isValidTimeSignature,
  isValidKeyRangeAdjustment,
  isValidvolumeRangeAdjustment,
  secondToTick,
  tickToSecond,
  calculateNotesHash,
  calculateSingingGuideSourceHash,
  calculateSingingVoiceSourceHash,
  decibelToLinear,
  applyPitchEdit,
  VALUE_INDICATING_NO_DATA,
  isValidPitchEditData,
} from "@/sing/domain";
import {
  DEFAULT_BEATS,
  DEFAULT_BEAT_TYPE,
  DEFAULT_BPM,
  DEPRECATED_DEFAULT_EDIT_FRAME_RATE,
  DEFAULT_TPQN,
  FrequentlyUpdatedState,
  addNotesToOverlappingNoteInfos,
  getOverlappingNoteIds,
  removeNotesFromOverlappingNoteInfos,
  updateNotesOfOverlappingNoteInfos,
} from "@/sing/storeHelper";
import { getDoremiFromNoteNumber } from "@/sing/viewHelper";
import {
  AnimationTimer,
  createPromiseThatResolvesWhen,
  round,
} from "@/sing/utility";
import { getWorkaroundKeyRangeAdjustment } from "@/sing/workaroundKeyRangeAdjustment";
import { createLogger } from "@/domain/frontend/log";
import { noteSchema } from "@/domain/project/schema";

const logger = createLogger("store/singing");

const generateAudioEvents = async (
  audioContext: BaseAudioContext,
  time: number,
  blob: Blob,
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

const playheadPosition = new FrequentlyUpdatedState(0);
const singingVoices = new Map<SingingVoiceSourceHash, SingingVoice>();
const sequences = new Map<string, Sequence>(); // キーはPhraseKey
const animationTimer = new AnimationTimer();

const singingGuideCache = new Map<SingingGuideSourceHash, SingingGuide>();
const singingVoiceCache = new Map<SingingVoiceSourceHash, SingingVoice>();

// TODO: マルチトラックに対応する
const selectedTrackIndex = 0;

export const generateSingingStoreInitialScore = () => {
  return {
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
    tracks: [
      {
        singer: undefined,
        keyRangeAdjustment: 0,
        volumeRangeAdjustment: 0,
        notes: [],
        pitchEditData: [],
      },
    ],
  };
};

export const singingStoreState: SingingStoreState = {
  ...generateSingingStoreInitialScore(),
  editFrameRate: DEPRECATED_DEFAULT_EDIT_FRAME_RATE,
  phrases: new Map(),
  singingGuides: new Map(),
  // NOTE: UIの状態は試行のためsinging.tsに局所化する+Hydrateが必要
  isShowSinger: true,
  sequencerZoomX: 0.5,
  sequencerZoomY: 0.75,
  sequencerSnapType: 16,
  sequencerEditTarget: "NOTE",
  selectedNoteIds: new Set(),
  overlappingNoteIds: new Set(),
  overlappingNoteInfos: new Map(),
  nowPlaying: false,
  volume: 0,
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

  SETUP_SINGER: {
    async action({ dispatch }, { singer }: { singer: Singer }) {
      // 指定されたstyleIdに対して、エンジン側の初期化を行う
      const isInitialized = await dispatch(
        "IS_INITIALIZED_ENGINE_SPEAKER",
        singer,
      );
      if (!isInitialized) {
        await dispatch("INITIALIZE_ENGINE_SPEAKER", singer);
      }
    },
  },

  SET_SINGER: {
    // 歌手をセットする。
    // withRelatedがtrueの場合、関連する情報もセットする。
    mutation(
      state,
      { singer, withRelated }: { singer?: Singer; withRelated?: boolean },
    ) {
      state.tracks[selectedTrackIndex].singer = singer;

      if (withRelated == true && singer != undefined) {
        // 音域調整量マジックナンバーを設定するワークアラウンド
        const keyRangeAdjustment = getWorkaroundKeyRangeAdjustment(
          state.characterInfos,
          singer,
        );
        state.tracks[selectedTrackIndex].keyRangeAdjustment =
          keyRangeAdjustment;
      }
    },
    async action(
      { state, getters, dispatch, commit },
      { singer, withRelated }: { singer?: Singer; withRelated?: boolean },
    ) {
      if (state.defaultStyleIds == undefined)
        throw new Error("state.defaultStyleIds == undefined");
      const userOrderedCharacterInfos =
        getters.USER_ORDERED_CHARACTER_INFOS("singerLike");
      if (userOrderedCharacterInfos == undefined)
        throw new Error("userOrderedCharacterInfos == undefined");

      const engineId = singer?.engineId ?? state.engineIds[0];

      // 最初のスタイルをソングエディタにおける仮のデフォルトスタイルとする
      // TODO: ソングエディタ向けのデフォルトスタイルをどうするか考える
      const defaultStyleId =
        userOrderedCharacterInfos[0].metas.styles[0].styleId;

      const styleId = singer?.styleId ?? defaultStyleId;

      dispatch("SETUP_SINGER", { singer: { engineId, styleId } });
      commit("SET_SINGER", { singer: { engineId, styleId }, withRelated });

      dispatch("RENDER");
    },
  },

  SET_KEY_RANGE_ADJUSTMENT: {
    mutation(state, { keyRangeAdjustment }: { keyRangeAdjustment: number }) {
      state.tracks[selectedTrackIndex].keyRangeAdjustment = keyRangeAdjustment;
    },
    async action(
      { dispatch, commit },
      { keyRangeAdjustment }: { keyRangeAdjustment: number },
    ) {
      if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
        throw new Error("The keyRangeAdjustment is invalid.");
      }
      commit("SET_KEY_RANGE_ADJUSTMENT", { keyRangeAdjustment });

      dispatch("RENDER");
    },
  },

  SET_VOLUME_RANGE_ADJUSTMENT: {
    mutation(
      state,
      { volumeRangeAdjustment }: { volumeRangeAdjustment: number },
    ) {
      state.tracks[selectedTrackIndex].volumeRangeAdjustment =
        volumeRangeAdjustment;
    },
    async action(
      { dispatch, commit },
      { volumeRangeAdjustment }: { volumeRangeAdjustment: number },
    ) {
      if (!isValidvolumeRangeAdjustment(volumeRangeAdjustment)) {
        throw new Error("The volumeRangeAdjustment is invalid.");
      }
      commit("SET_VOLUME_RANGE_ADJUSTMENT", {
        volumeRangeAdjustment,
      });

      dispatch("RENDER");
    },
  },

  SET_SCORE: {
    mutation(state, { score }: { score: Score }) {
      state.overlappingNoteInfos.clear();
      state.overlappingNoteIds.clear();
      state.editingLyricNoteId = undefined;
      state.selectedNoteIds.clear();
      state.tpqn = score.tpqn;
      state.tempos = score.tempos;
      state.timeSignatures = score.timeSignatures;
      state.tracks[selectedTrackIndex].notes = score.notes;
      addNotesToOverlappingNoteInfos(state.overlappingNoteInfos, score.notes);
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos,
      );
    },
    async action(
      { state, getters, commit, dispatch },
      { score }: { score: Score },
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
      const index = state.tempos.findIndex((value) => {
        return value.position === tempo.position;
      });
      const tempos = [...state.tempos];
      if (index !== -1) {
        tempos.splice(index, 1, tempo);
      } else {
        tempos.push(tempo);
        tempos.sort((a, b) => a.position - b.position);
      }
      state.tempos = tempos;
    },
  },

  REMOVE_TEMPO: {
    mutation(state, { position }: { position: number }) {
      const index = state.tempos.findIndex((value) => {
        return value.position === position;
      });
      if (index === -1) {
        throw new Error("The tempo does not exist.");
      }
      const tempos = [...state.tempos];
      if (index === 0) {
        tempos.splice(index, 1, {
          position: 0,
          bpm: DEFAULT_BPM,
        });
      } else {
        tempos.splice(index, 1);
      }
      state.tempos = tempos;
    },
  },

  SET_TIME_SIGNATURE: {
    mutation(state, { timeSignature }: { timeSignature: TimeSignature }) {
      const index = state.timeSignatures.findIndex((value) => {
        return value.measureNumber === timeSignature.measureNumber;
      });
      const timeSignatures = [...state.timeSignatures];
      if (index !== -1) {
        timeSignatures.splice(index, 1, timeSignature);
      } else {
        timeSignatures.push(timeSignature);
        timeSignatures.sort((a, b) => a.measureNumber - b.measureNumber);
      }
      state.timeSignatures = timeSignatures;
    },
  },

  REMOVE_TIME_SIGNATURE: {
    mutation(state, { measureNumber }: { measureNumber: number }) {
      const index = state.timeSignatures.findIndex((value) => {
        return value.measureNumber === measureNumber;
      });
      if (index === -1) {
        throw new Error("The time signature does not exist.");
      }
      const timeSignatures = [...state.timeSignatures];
      if (index === 0) {
        timeSignatures.splice(index, 1, {
          measureNumber: 1,
          beats: DEFAULT_BEATS,
          beatType: DEFAULT_BEAT_TYPE,
        });
      } else {
        timeSignatures.splice(index, 1);
      }
      state.timeSignatures = timeSignatures;
    },
  },

  NOTE_IDS: {
    getter(state) {
      const selectedTrack = state.tracks[selectedTrackIndex];
      const noteIds = selectedTrack.notes.map((value) => value.id);
      return new Set(noteIds);
    },
  },

  ADD_NOTES: {
    mutation(state, { notes }: { notes: Note[] }) {
      const selectedTrack = state.tracks[selectedTrackIndex];
      const newNotes = [...selectedTrack.notes, ...notes];
      newNotes.sort((a, b) => a.position - b.position);
      selectedTrack.notes = newNotes;
      addNotesToOverlappingNoteInfos(state.overlappingNoteInfos, notes);
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos,
      );
    },
  },

  UPDATE_NOTES: {
    mutation(state, { notes }: { notes: Note[] }) {
      const notesMap = new Map<NoteId, Note>();
      for (const note of notes) {
        notesMap.set(note.id, note);
      }
      const selectedTrack = state.tracks[selectedTrackIndex];
      selectedTrack.notes = selectedTrack.notes
        .map((value) => notesMap.get(value.id) ?? value)
        .sort((a, b) => a.position - b.position);
      updateNotesOfOverlappingNoteInfos(state.overlappingNoteInfos, notes);
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos,
      );
    },
  },

  REMOVE_NOTES: {
    mutation(state, { noteIds }: { noteIds: NoteId[] }) {
      const noteIdsSet = new Set(noteIds);
      const selectedTrack = state.tracks[selectedTrackIndex];
      const notes = selectedTrack.notes.filter((value) => {
        return noteIdsSet.has(value.id);
      });
      removeNotesFromOverlappingNoteInfos(state.overlappingNoteInfos, notes);
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos,
      );
      if (
        state.editingLyricNoteId != undefined &&
        noteIdsSet.has(state.editingLyricNoteId)
      ) {
        state.editingLyricNoteId = undefined;
      }
      for (const noteId of noteIds) {
        state.selectedNoteIds.delete(noteId);
      }
      selectedTrack.notes = selectedTrack.notes.filter((value) => {
        return !noteIdsSet.has(value.id);
      });
    },
  },

  SELECT_NOTES: {
    mutation(state, { noteIds }: { noteIds: NoteId[] }) {
      for (const noteId of noteIds) {
        state.selectedNoteIds.add(noteId);
      }
    },
    async action({ getters, commit }, { noteIds }: { noteIds: NoteId[] }) {
      const existingNoteIds = getters.NOTE_IDS;
      const isValidNoteIds = noteIds.every((value) => {
        return existingNoteIds.has(value);
      });
      if (!isValidNoteIds) {
        throw new Error("The note ids are invalid.");
      }
      commit("SELECT_NOTES", { noteIds });
    },
  },

  SELECT_ALL_NOTES: {
    mutation(state) {
      const currentTrack = state.tracks[selectedTrackIndex];
      const allNoteIds = currentTrack.notes.map((note) => note.id);
      state.selectedNoteIds = new Set(allNoteIds);
    },
    async action({ commit }) {
      commit("SELECT_ALL_NOTES");
    },
  },

  DESELECT_ALL_NOTES: {
    mutation(state) {
      state.editingLyricNoteId = undefined;
      state.selectedNoteIds = new Set();
    },
    async action({ commit }) {
      commit("DESELECT_ALL_NOTES");
    },
  },

  SET_EDITING_LYRIC_NOTE_ID: {
    mutation(state, { noteId }: { noteId?: NoteId }) {
      if (noteId != undefined && !state.selectedNoteIds.has(noteId)) {
        state.selectedNoteIds.clear();
        state.selectedNoteIds.add(noteId);
      }
      state.editingLyricNoteId = noteId;
    },
    async action({ getters, commit }, { noteId }: { noteId?: NoteId }) {
      if (noteId != undefined && !getters.NOTE_IDS.has(noteId)) {
        throw new Error("The note id is invalid.");
      }
      commit("SET_EDITING_LYRIC_NOTE_ID", { noteId });
    },
  },

  SET_PITCH_EDIT_DATA: {
    // ピッチ編集データをセットする。
    // track.pitchEditDataの長さが足りない場合は、伸長も行う。
    mutation(
      state,
      { data, startFrame }: { data: number[]; startFrame: number },
    ) {
      const pitchEditData = state.tracks[selectedTrackIndex].pitchEditData;
      const tempData = [...pitchEditData];
      const endFrame = startFrame + data.length;
      if (tempData.length < endFrame) {
        const valuesToPush = new Array(endFrame - tempData.length).fill(
          VALUE_INDICATING_NO_DATA,
        );
        tempData.push(...valuesToPush);
      }
      tempData.splice(startFrame, data.length, ...data);
      state.tracks[selectedTrackIndex].pitchEditData = tempData;
    },
    async action(
      { dispatch, commit },
      { data, startFrame }: { data: number[]; startFrame: number },
    ) {
      if (startFrame < 0) {
        throw new Error("startFrame must be greater than or equal to 0.");
      }
      if (!isValidPitchEditData(data)) {
        throw new Error("The pitch edit data is invalid.");
      }
      commit("SET_PITCH_EDIT_DATA", { data, startFrame });

      dispatch("RENDER");
    },
  },

  ERASE_PITCH_EDIT_DATA: {
    mutation(
      state,
      { startFrame, frameLength }: { startFrame: number; frameLength: number },
    ) {
      const pitchEditData = state.tracks[selectedTrackIndex].pitchEditData;
      const tempData = [...pitchEditData];
      const endFrame = Math.min(startFrame + frameLength, tempData.length);
      tempData.fill(VALUE_INDICATING_NO_DATA, startFrame, endFrame);
      state.tracks[selectedTrackIndex].pitchEditData = tempData;
    },
  },

  CLEAR_PITCH_EDIT_DATA: {
    // ピッチ編集データを失くす。
    mutation(state) {
      state.tracks[selectedTrackIndex].pitchEditData = [];
    },
    async action({ dispatch, commit }) {
      commit("CLEAR_PITCH_EDIT_DATA");

      dispatch("RENDER");
    },
  },

  SET_PHRASES: {
    mutation(state, { phrases }: { phrases: Map<string, Phrase> }) {
      state.phrases = phrases;
    },
  },

  SET_STATE_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        phraseState,
      }: { phraseKey: string; phraseState: PhraseState },
    ) {
      const phrase = state.phrases.get(phraseKey);
      if (phrase == undefined) {
        throw new Error("phrase is undefined.");
      }
      phrase.state = phraseState;
    },
  },

  SET_SINGING_GUIDE_KEY_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        singingGuideKey,
      }: {
        phraseKey: string;
        singingGuideKey: SingingGuideSourceHash | undefined;
      },
    ) {
      const phrase = state.phrases.get(phraseKey);
      if (phrase == undefined) {
        throw new Error("phrase is undefined.");
      }
      phrase.singingGuideKey = singingGuideKey;
    },
  },

  SET_SINGING_VOICE_KEY_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        singingVoiceKey,
      }: {
        phraseKey: string;
        singingVoiceKey: SingingVoiceSourceHash | undefined;
      },
    ) {
      const phrase = state.phrases.get(phraseKey);
      if (phrase == undefined) {
        throw new Error("phrase is undefined.");
      }
      phrase.singingVoiceKey = singingVoiceKey;
    },
  },

  SET_SINGING_GUIDE: {
    mutation(
      state,
      {
        singingGuideKey,
        singingGuide,
      }: {
        singingGuideKey: SingingGuideSourceHash;
        singingGuide: SingingGuide;
      },
    ) {
      state.singingGuides.set(singingGuideKey, singingGuide);
    },
  },

  DELETE_SINGING_GUIDE: {
    mutation(
      state,
      { singingGuideKey }: { singingGuideKey: SingingGuideSourceHash },
    ) {
      state.singingGuides.delete(singingGuideKey);
    },
  },

  SELECTED_TRACK: {
    getter(state) {
      return state.tracks[selectedTrackIndex];
    },
  },

  SET_SNAP_TYPE: {
    mutation(state, { snapType }) {
      state.sequencerSnapType = snapType;
    },
    async action({ state, commit }, { snapType }) {
      const tpqn = state.tpqn;
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
      commit("SET_ZOOM_X", { zoomX });
    },
  },

  SET_ZOOM_Y: {
    mutation(state, { zoomY }: { zoomY: number }) {
      state.sequencerZoomY = zoomY;
    },
    async action({ commit }, { zoomY }) {
      commit("SET_ZOOM_Y", { zoomY });
    },
  },

  SET_EDIT_TARGET: {
    mutation(state, { editTarget }: { editTarget: SequencerEditTarget }) {
      state.sequencerEditTarget = editTarget;
    },
    async action(
      { commit },
      { editTarget }: { editTarget: SequencerEditTarget },
    ) {
      commit("SET_EDIT_TARGET", { editTarget });
    },
  },

  TICK_TO_SECOND: {
    getter: (state) => (position) => {
      return tickToSecond(position, state.tempos, state.tpqn);
    },
  },

  SECOND_TO_TICK: {
    getter: (state) => (time) => {
      return secondToTick(time, state.tempos, state.tpqn);
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
      animationTimer.start(() => {
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
      animationTimer.stop();
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
      { noteNumber, duration }: { noteNumber: number; duration?: number },
    ) {
      if (!audioContext) {
        throw new Error("audioContext is undefined.");
      }
      if (!previewSynth) {
        throw new Error("previewSynth is undefined.");
      }
      previewSynth.noteOn("immediately", noteNumber, duration);
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
      previewSynth.noteOff("immediately", noteNumber);
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
      const searchPhrases = async (notes: Note[]) => {
        const foundPhrases = new Map<string, Phrase>();
        let phraseNotes: Note[] = [];
        for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
          const note = notes[noteIndex];

          phraseNotes.push(note);

          // ノートが途切れていたら別のフレーズにする
          const currentNoteEnd = note.position + note.duration;
          const nextNoteStart =
            noteIndex + 1 < notes.length ? notes[noteIndex + 1].position : null;
          if (
            noteIndex === notes.length - 1 ||
            nextNoteStart == null ||
            currentNoteEnd !== nextNoteStart
          ) {
            const notesHash = await calculateNotesHash(phraseNotes);
            foundPhrases.set(notesHash, {
              notes: phraseNotes,
              state: "WAITING_TO_BE_RENDERED",
            });

            phraseNotes = [];
          }
        }
        return foundPhrases;
      };

      const createNotesForRequestToEngine = (
        notes: Note[],
        tempos: Tempo[],
        tpqn: number,
        keyRangeAdjustment: number,
        frameRate: number,
        restDurationSeconds: number,
      ) => {
        const restFrameLength = Math.round(restDurationSeconds * frameRate);
        const notesForRequestToEngine: NoteForRequestToEngine[] = [];

        // 先頭に休符を追加
        notesForRequestToEngine.push({
          key: undefined,
          frameLength: restFrameLength,
          lyric: "",
        });
        // ノートを変換
        const firstNoteOnTime = tickToSecond(notes[0].position, tempos, tpqn);
        let frame = 0;
        for (const note of notes) {
          const noteOffTime = tickToSecond(
            note.position + note.duration,
            tempos,
            tpqn,
          );
          const noteOffFrame = Math.round(
            (noteOffTime - firstNoteOnTime) * frameRate,
          );
          const noteFrameLength = Math.max(1, noteOffFrame - frame);
          // トランスポーズする
          const key = note.noteNumber - keyRangeAdjustment;
          notesForRequestToEngine.push({
            key,
            frameLength: noteFrameLength,
            lyric: note.lyric,
          });
          frame += noteFrameLength;
        }
        // 末尾に休符を追加
        notesForRequestToEngine.push({
          key: undefined,
          frameLength: restFrameLength,
          lyric: "",
        });

        return notesForRequestToEngine;
      };

      const singingTeacherStyleId = StyleId(6000); // TODO: 設定できるようにする

      const fetchQuery = async (
        engineId: EngineId,
        notes: Note[],
        tempos: Tempo[],
        tpqn: number,
        keyRangeAdjustment: number,
        frameRate: number,
        restDurationSeconds: number,
      ) => {
        const notesForRequestToEngine = createNotesForRequestToEngine(
          notes,
          tempos,
          tpqn,
          keyRangeAdjustment,
          frameRate,
          restDurationSeconds,
        );

        try {
          if (!getters.IS_ENGINE_READY(engineId)) {
            throw new Error("Engine not ready.");
          }
          const instance = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId,
          });
          return await instance.invoke(
            "singFrameAudioQuerySingFrameAudioQueryPost",
          )({
            score: { notes: notesForRequestToEngine },
            speaker: singingTeacherStyleId,
          });
        } catch (error) {
          const lyrics = notesForRequestToEngine
            .map((value) => value.lyric)
            .join("");
          logger.error(
            `Failed to fetch FrameAudioQuery. Lyrics of score are "${lyrics}".`,
            error,
          );
          throw error;
        }
      };

      const getPhonemes = (frameAudioQuery: FrameAudioQuery) => {
        return frameAudioQuery.phonemes.map((value) => value.phoneme).join(" ");
      };

      const shiftGuidePitch = (
        pitchShift: number,
        frameAudioQuery: FrameAudioQuery,
      ) => {
        frameAudioQuery.f0 = frameAudioQuery.f0.map((value) => {
          return value * Math.pow(2, pitchShift / 12);
        });
      };

      const scaleGuideVolume = (
        volumeRangeAdjustment: number,
        frameAudioQuery: FrameAudioQuery,
      ) => {
        frameAudioQuery.volume = frameAudioQuery.volume.map((value) => {
          return value * decibelToLinear(volumeRangeAdjustment);
        });
      };

      const calcStartTime = (
        notes: Note[],
        tempos: Tempo[],
        tpqn: number,
        restDurationSeconds: number,
      ) => {
        let startTime = tickToSecond(notes[0].position, tempos, tpqn);
        startTime -= restDurationSeconds;
        return startTime;
      };

      const synthesize = async (singer: Singer, query: FrameAudioQuery) => {
        if (!getters.IS_ENGINE_READY(singer.engineId)) {
          throw new Error("Engine not ready.");
        }

        try {
          const instance = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId: singer.engineId,
          });
          return await instance.invoke("frameSynthesisFrameSynthesisPost")({
            frameAudioQuery: query,
            speaker: singer.styleId,
          });
        } catch (error) {
          const phonemes = query.phonemes
            .map((value) => value.phoneme)
            .join(" ");
          logger.error(
            `Failed to synthesis. Phonemes are "${phonemes}".`,
            error,
          );
          throw error;
        }
      };

      const getAudioSourceNode = (sequence: Sequence) => {
        if (sequence.type === "note") {
          return sequence.instrument.output;
        } else if (sequence.type === "audio") {
          return sequence.audioPlayer.output;
        } else {
          throw new Error("Unknown type of sequence.");
        }
      };

      // NOTE: 型推論でawaitの前か後かが考慮されないので、関数を介して取得する（型がbooleanになるようにする）
      const startRenderingRequested = () => state.startRenderingRequested;
      const stopRenderingRequested = () => state.stopRenderingRequested;

      const render = async () => {
        if (!audioContext) {
          throw new Error("audioContext is undefined.");
        }
        if (!transport) {
          throw new Error("transport is undefined.");
        }
        if (!channelStrip) {
          throw new Error("channelStrip is undefined.");
        }
        const audioContextRef = audioContext;
        const transportRef = transport;
        const channelStripRef = channelStrip;
        const trackRef = getters.SELECTED_TRACK;

        // レンダリング中に変更される可能性のあるデータをコピーする
        // 重なっているノートの削除も行う
        const tpqn = state.tpqn;
        const tempos = state.tempos.map((value) => ({ ...value }));
        const singerAndFrameRate = trackRef.singer
          ? {
              singer: { ...trackRef.singer },
              frameRate:
                state.engineManifests[trackRef.singer.engineId].frameRate,
            }
          : undefined;
        const keyRangeAdjustment = trackRef.keyRangeAdjustment;
        const volumeRangeAdjustment = trackRef.volumeRangeAdjustment;
        const notes = trackRef.notes
          .map((value) => ({ ...value }))
          .filter((value) => !state.overlappingNoteIds.has(value.id));
        const pitchEditData = [...trackRef.pitchEditData];
        const editFrameRate = state.editFrameRate;
        const restDurationSeconds = 1; // 前後の休符の長さはとりあえず1秒に設定

        // フレーズを更新する

        const foundPhrases = await searchPhrases(notes);

        for (const [phraseKey, phrase] of state.phrases) {
          const notesHash = phraseKey;
          if (!foundPhrases.has(notesHash)) {
            // 歌い方と歌声を削除する
            if (phrase.singingGuideKey != undefined) {
              commit("DELETE_SINGING_GUIDE", {
                singingGuideKey: phrase.singingGuideKey,
              });
            }
            if (phrase.singingVoiceKey != undefined) {
              singingVoices.delete(phrase.singingVoiceKey);
            }

            // 音源とシーケンスの接続を解除して削除する
            const sequence = sequences.get(phraseKey);
            if (sequence) {
              getAudioSourceNode(sequence).disconnect();
              transportRef.removeSequence(sequence);
              sequences.delete(phraseKey);
            }
          }
        }

        const phrases = new Map<string, Phrase>();

        for (const [notesHash, foundPhrase] of foundPhrases) {
          const phraseKey = notesHash;
          const existingPhrase = state.phrases.get(phraseKey);
          if (!existingPhrase) {
            // 新しいフレーズの場合
            phrases.set(phraseKey, foundPhrase);
            continue;
          }

          // すでに存在するフレーズの場合
          // 再レンダリングする必要があるかどうかをチェックする
          // シンガーが未設定の場合、とりあえず常に再レンダリングする
          // 音声合成を行う必要がある場合、現在フレーズに設定されている歌声を削除する
          // 歌い方の推論も行う必要がある場合、現在フレーズに設定されている歌い方を削除する
          // TODO: リファクタリングする
          const phrase = { ...existingPhrase };
          if (!singerAndFrameRate || phrase.state === "COULD_NOT_RENDER") {
            if (phrase.singingGuideKey != undefined) {
              commit("DELETE_SINGING_GUIDE", {
                singingGuideKey: phrase.singingGuideKey,
              });
              phrase.singingGuideKey = undefined;
            }
            if (phrase.singingVoiceKey != undefined) {
              singingVoices.delete(phrase.singingVoiceKey);
              phrase.singingVoiceKey = undefined;
            }
          } else {
            if (phrase.singingGuideKey != undefined) {
              const calculatedHash = await calculateSingingGuideSourceHash({
                engineId: singerAndFrameRate.singer.engineId,
                tpqn,
                tempos,
                notes: phrase.notes,
                keyRangeAdjustment,
                volumeRangeAdjustment,
                frameRate: singerAndFrameRate.frameRate,
                restDurationSeconds,
              });
              const hash = phrase.singingGuideKey;
              if (hash !== calculatedHash) {
                commit("DELETE_SINGING_GUIDE", {
                  singingGuideKey: phrase.singingGuideKey,
                });
                phrase.singingGuideKey = undefined;
                if (phrase.singingVoiceKey != undefined) {
                  singingVoices.delete(phrase.singingVoiceKey);
                  phrase.singingVoiceKey = undefined;
                }
              }
            }
            if (
              phrase.singingGuideKey != undefined &&
              phrase.singingVoiceKey != undefined
            ) {
              let singingGuide = state.singingGuides.get(
                phrase.singingGuideKey,
              );
              if (singingGuide == undefined) {
                throw new Error("singingGuide is undefined.");
              }
              // 歌い方をコピーして、ピッチ編集を適用する
              singingGuide = structuredClone(toRaw(singingGuide));
              applyPitchEdit(singingGuide, pitchEditData, editFrameRate);

              const calculatedHash = await calculateSingingVoiceSourceHash({
                singer: singerAndFrameRate.singer,
                frameAudioQuery: singingGuide.query,
              });
              const hash = phrase.singingVoiceKey;
              if (hash !== calculatedHash) {
                singingVoices.delete(phrase.singingVoiceKey);
                phrase.singingVoiceKey = undefined;
              }
            }
          }
          if (
            phrase.singingGuideKey == undefined ||
            phrase.singingVoiceKey == undefined
          ) {
            phrase.state = "WAITING_TO_BE_RENDERED";
          }

          phrases.set(phraseKey, phrase);
        }

        commit("SET_PHRASES", { phrases });

        logger.info("Phrases updated.");

        // 各フレーズのレンダリングを行う

        const phrasesToBeRendered = new Map(
          [...state.phrases.entries()].filter(([, phrase]) => {
            return phrase.state === "WAITING_TO_BE_RENDERED";
          }),
        );
        for (const [phraseKey, phrase] of phrasesToBeRendered) {
          // シーケンスが存在する場合、シーケンスの接続を解除して削除する
          // TODO: ピッチを編集したときは行わないようにする

          const sequence = sequences.get(phraseKey);
          if (sequence) {
            getAudioSourceNode(sequence).disconnect();
            transportRef.removeSequence(sequence);
            sequences.delete(phraseKey);
          }

          // シーケンスが存在しない場合、ノートシーケンスを作成してプレビュー音が鳴るようにする

          if (!sequences.has(phraseKey)) {
            const noteEvents = generateNoteEvents(phrase.notes, tempos, tpqn);
            const polySynth = new PolySynth(audioContextRef);
            const noteSequence: NoteSequence = {
              type: "note",
              instrument: polySynth,
              noteEvents,
            };
            polySynth.output.connect(channelStripRef.input);
            transportRef.addSequence(noteSequence);
            sequences.set(phraseKey, noteSequence);
          }
        }
        while (phrasesToBeRendered.size > 0) {
          if (startRenderingRequested() || stopRenderingRequested()) {
            return;
          }
          const [phraseKey, phrase] = selectPriorPhrase(
            phrasesToBeRendered,
            playheadPosition.value,
          );
          phrasesToBeRendered.delete(phraseKey);

          // シンガーが未設定の場合は、歌い方の生成や音声合成は行わない

          if (!singerAndFrameRate) {
            commit("SET_STATE_TO_PHRASE", {
              phraseKey,
              phraseState: "PLAYABLE",
            });
            continue;
          }

          commit("SET_STATE_TO_PHRASE", {
            phraseKey,
            phraseState: "NOW_RENDERING",
          });

          try {
            // 歌い方が存在する場合、歌い方を取得する
            // 歌い方が存在しない場合、キャッシュがあれば取得し、なければ歌い方を生成する

            let singingGuide: SingingGuide | undefined;
            if (phrase.singingGuideKey != undefined) {
              singingGuide = state.singingGuides.get(phrase.singingGuideKey);
              if (!singingGuide) {
                throw new Error("singingGuide is undefined.");
              }
            } else {
              const singingGuideSourceHash =
                await calculateSingingGuideSourceHash({
                  engineId: singerAndFrameRate.singer.engineId,
                  tpqn,
                  tempos,
                  notes: phrase.notes,
                  keyRangeAdjustment,
                  volumeRangeAdjustment,
                  frameRate: singerAndFrameRate.frameRate,
                  restDurationSeconds,
                });

              const singingGuideKey = singingGuideSourceHash;
              const cachedSingingGuide = singingGuideCache.get(singingGuideKey);
              if (cachedSingingGuide) {
                singingGuide = cachedSingingGuide;

                logger.info(`Loaded singing guide from cache.`);
              } else {
                const query = await fetchQuery(
                  singerAndFrameRate.singer.engineId,
                  phrase.notes,
                  tempos,
                  tpqn,
                  keyRangeAdjustment,
                  singerAndFrameRate.frameRate,
                  restDurationSeconds,
                );

                const phonemes = getPhonemes(query);
                logger.info(
                  `Fetched frame audio query. Phonemes are "${phonemes}".`,
                );

                // 音域調整を適用する
                shiftGuidePitch(keyRangeAdjustment, query);

                const startTime = calcStartTime(
                  phrase.notes,
                  tempos,
                  tpqn,
                  restDurationSeconds,
                );

                singingGuide = {
                  query,
                  frameRate: singerAndFrameRate.frameRate,
                  startTime,
                };

                singingGuideCache.set(singingGuideKey, singingGuide);
              }
              commit("SET_SINGING_GUIDE", { singingGuideKey, singingGuide });
              commit("SET_SINGING_GUIDE_KEY_TO_PHRASE", {
                phraseKey,
                singingGuideKey,
              });
            }

            // ピッチ編集を適用する前に、歌い方をコピーする

            singingGuide = structuredClone(toRaw(singingGuide));

            // ピッチ編集を適用する

            applyPitchEdit(singingGuide, pitchEditData, editFrameRate);

            // 歌声のキャッシュがあれば取得し、なければ音声合成を行う

            let singingVoice: SingingVoice | undefined;

            const singingVoiceSourceHash =
              await calculateSingingVoiceSourceHash({
                singer: singerAndFrameRate.singer,
                frameAudioQuery: singingGuide.query,
              });

            const singingVoiceKey = singingVoiceSourceHash;
            const cachedSingingVoice = singingVoiceCache.get(singingVoiceKey);
            if (cachedSingingVoice) {
              singingVoice = cachedSingingVoice;

              logger.info(`Loaded singing voice from cache.`);
            } else {
              // 音量生成用のクエリを作る
              // ピッチ編集を適用したクエリをコピーし、
              // f0をもう一度シフトして、f0生成時の（シフトする前の）高さに戻す
              const queryForVolume = structuredClone(singingGuide.query);
              shiftGuidePitch(-keyRangeAdjustment, queryForVolume);

              // 音量生成用のクエリから音量を作る
              // 音量値はAPIを叩く毎に変わるので、calc hashしたあとに音量を取得している
              const notesForRequestToEngine = createNotesForRequestToEngine(
                phrase.notes,
                tempos,
                tpqn,
                keyRangeAdjustment, // f0を生成するときと同様に、noteのkeyのシフトを行う
                singingGuide.frameRate,
                restDurationSeconds,
              );
              const volumes = await dispatch("FETCH_SING_FRAME_VOLUME", {
                notes: notesForRequestToEngine,
                frameAudioQuery: queryForVolume,
                styleId: singingTeacherStyleId,
                engineId: singerAndFrameRate.singer.engineId,
              });
              singingGuide.query.volume = volumes;

              // 声量調整を適用する
              scaleGuideVolume(volumeRangeAdjustment, singingGuide.query);

              const blob = await synthesize(
                singerAndFrameRate.singer,
                singingGuide.query,
              );

              logger.info(`Synthesized.`);

              singingVoice = { blob };
              singingVoiceCache.set(singingVoiceKey, singingVoice);
            }
            singingVoices.set(singingVoiceKey, singingVoice);
            commit("SET_SINGING_VOICE_KEY_TO_PHRASE", {
              phraseKey,
              singingVoiceKey,
            });

            // シーケンスが存在する場合、シーケンスの接続を解除して削除する

            const sequence = sequences.get(phraseKey);
            if (sequence) {
              getAudioSourceNode(sequence).disconnect();
              transportRef.removeSequence(sequence);
              sequences.delete(phraseKey);
            }

            // オーディオシーケンスを作成して接続する

            const audioEvents = await generateAudioEvents(
              audioContextRef,
              singingGuide.startTime,
              singingVoice.blob,
            );
            const audioPlayer = new AudioPlayer(audioContextRef);
            const audioSequence: AudioSequence = {
              type: "audio",
              audioPlayer,
              audioEvents,
            };
            audioPlayer.output.connect(channelStripRef.input);
            transportRef.addSequence(audioSequence);
            sequences.set(phraseKey, audioSequence);

            commit("SET_STATE_TO_PHRASE", {
              phraseKey,
              phraseState: "PLAYABLE",
            });
          } catch (error) {
            commit("SET_STATE_TO_PHRASE", {
              phraseKey,
              phraseState: "COULD_NOT_RENDER",
            });
            // とりあえずエラーはロギングしてcontinueする
            // NOTE: ほとんどは歌詞のエラー
            // FIXME: 歌詞以外のエラーの場合はthrowして、エラーダイアログを表示するようにする
            logger.error("An error occurred while rendering a phrase.", error);
            continue;
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
      } catch (error) {
        logger.error("render error", error);
        throw error;
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
        logger.info("Waiting for rendering to stop...");
        commit("SET_STOP_RENDERING_REQUESTED", {
          stopRenderingRequested: true,
        });
        await createPromiseThatResolvesWhen(() => !state.nowRendering);
        logger.info("Rendering stopped.");
      }
    }),
  },

  IMPORT_MIDI_FILE: {
    action: createUILockAction(
      async (
        { dispatch },
        { filePath, trackIndex = 0 }: { filePath: string; trackIndex: number },
      ) => {
        const convertPosition = (
          position: number,
          sourceTpqn: number,
          targetTpqn: number,
        ) => {
          return Math.round(position * (targetTpqn / sourceTpqn));
        };

        const convertDuration = (
          startPosition: number,
          endPosition: number,
          sourceTpqn: number,
          targetTpqn: number,
        ) => {
          const convertedEndPosition = convertPosition(
            endPosition,
            sourceTpqn,
            targetTpqn,
          );
          const convertedStartPosition = convertPosition(
            startPosition,
            sourceTpqn,
            targetTpqn,
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
          timeSignatures: TimeSignature[],
        ) => {
          return timeSignatures.filter((value, index, array) => {
            return (
              index === array.length - 1 ||
              value.measureNumber !== array[index + 1].measureNumber
            );
          });
        };

        // NOTE: トラック選択のために一度ファイルを読み込んでいるので、Midiを渡すなどでもよさそう
        const midiData = getValueOrThrow(
          await window.backend.readFile({ filePath }),
        );
        const midi = new Midi(midiData);
        const midiTpqn = midi.ticksPerBeat;
        const midiTempos = midi.tempos;
        const midiTimeSignatures = midi.timeSignatures;

        const midiNotes = midi.tracks[trackIndex].notes;

        midiNotes.sort((a, b) => a.ticks - b.ticks);

        const tpqn = DEFAULT_TPQN;

        let notes = midiNotes.map((value): Note => {
          return {
            id: NoteId(uuidv4()),
            position: convertPosition(value.ticks, midiTpqn, tpqn),
            duration: convertDuration(
              value.ticks,
              value.ticks + value.duration,
              midiTpqn,
              tpqn,
            ),
            noteNumber: value.noteNumber,
            lyric: value.lyric || getDoremiFromNoteNumber(value.noteNumber),
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
          const beats = midiTs.numerator;
          const beatType = midiTs.denominator;
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
      },
    ),
  },

  IMPORT_MUSICXML_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        if (!filePath) {
          filePath = await window.backend.showImportFileDialog({
            title: "MusicXML読み込み",
            name: "MusicXML",
            extensions: ["musicxml", "xml"],
          });
          if (!filePath) return;
        }

        let xmlStr = new TextDecoder("utf-8").decode(
          getValueOrThrow(await window.backend.readFile({ filePath })),
        );
        if (xmlStr.indexOf("\ufffd") > -1) {
          xmlStr = new TextDecoder("shift-jis").decode(
            getValueOrThrow(await window.backend.readFile({ filePath })),
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
          tpqn,
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
          qualifiedName: string,
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
          if (stepChar == null) {
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
          let lyric = getChild(lyricElement, "text")?.textContent ?? "";
          lyric = lyric.trim();

          let tie = getTie(noteElement);
          for (const childElement of noteElement.children) {
            if (childElement.tagName === "notations") {
              tie = getTie(childElement);
            }
          }

          const note: Note = {
            id: NoteId(uuidv4()),
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
      },
    ),
  },

  IMPORT_UST_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        // USTファイルの読み込み
        if (!filePath) {
          filePath = await window.backend.showImportFileDialog({
            title: "UST読み込み",
            name: "UST",
            extensions: ["ust"],
          });
          if (!filePath) return;
        }
        // ファイルの読み込み
        const fileData = getValueOrThrow(
          await window.backend.readFile({ filePath }),
        );

        // ファイルフォーマットに応じてエンコーディングを変える
        // UTF-8とShiftJISの2種類に対応
        let ustData;
        try {
          ustData = new TextDecoder("utf-8").decode(fileData);
          // ShiftJISの場合はShiftJISでデコードし直す
          if (ustData.includes("\ufffd")) {
            ustData = new TextDecoder("shift-jis").decode(fileData);
          }
        } catch (error) {
          throw new Error("Failed to decode UST file.", { cause: error });
        }
        if (!ustData || typeof ustData !== "string") {
          throw new Error("Failed to decode UST file.");
        }

        // 初期化
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

        // USTファイルのセクションをパース
        const parseSection = (section: string): { [key: string]: string } => {
          const sectionNameMatch = section.match(/\[(.+)\]/);
          if (!sectionNameMatch) {
            throw new Error("UST section name not found");
          }
          const params = section.split(/[\r\n]+/).reduce(
            (acc, line) => {
              const [key, value] = line.split("=");
              if (key && value) {
                acc[key] = value;
              }
              return acc;
            },
            {} as { [key: string]: string },
          );
          return {
            ...params,
            sectionName: sectionNameMatch[1],
          };
        };

        // セクションを分割
        const sections = ustData.split(/^(?=\[)/m);
        // ポジション
        let position = 0;
        // セクションごとに処理
        sections.forEach((section) => {
          const params = parseSection(section);
          // SETTINGセクション
          if (params.sectionName === "#SETTING") {
            const tempo = Number(params["Tempo"]);
            if (tempo) tempos[0].bpm = tempo;
          }
          // ノートセクション
          // #以降に数字の場合はノートセクション ex: #0, #0000
          if (params.sectionName.match(/^#\d+$/)) {
            // テンポ変更があれば追加
            const tempo = Number(params["Tempo"]);
            if (tempo) tempos.push({ position, bpm: tempo });
            const noteNumber = Number(params["NoteNum"]);
            const duration = Number(params["Length"]);
            let lyric = params["Lyric"].trim();
            // 歌詞の前に連続音が含まれている場合は除去
            if (lyric.includes(" ")) {
              lyric = lyric.split(" ")[1];
            }
            // 休符であればポジションを進めるのみ
            if (lyric === "R") {
              position += duration;
            } else {
              // それ以外の場合はノートを追加
              notes.push({
                id: NoteId(uuidv4()),
                position,
                duration,
                noteNumber,
                lyric,
              });
              position += duration;
            }
          }
        });

        await dispatch("SET_SCORE", {
          score: {
            tpqn,
            tempos,
            timeSignatures,
            notes,
          },
        });
      },
    ),
  },

  FETCH_SING_FRAME_VOLUME: {
    async action(
      { dispatch },
      {
        notes,
        frameAudioQuery,
        engineId,
        styleId,
      }: {
        notes: NoteForRequestToEngine[];
        frameAudioQuery: FrameAudioQuery;
        engineId: EngineId;
        styleId: StyleId;
      },
    ) {
      const instance = await dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
        engineId,
      });
      return await instance.invoke("singFrameVolumeSingFrameVolumePost")({
        bodySingFrameVolumeSingFrameVolumePost: {
          score: {
            notes,
          },
          frameAudioQuery,
        },
        speaker: styleId,
      });
    },
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
          // TODO: マルチトラックに対応する
          const notes = getters.SELECTED_TRACK.notes;
          if (notes.length === 0) {
            return 1;
          }
          const lastNote = notes[notes.length - 1];
          const lastNoteEndPosition = lastNote.position + lastNote.duration;
          const lastNoteEndTime = getters.TICK_TO_SECOND(lastNoteEndPosition);
          return Math.max(1, lastNoteEndTime + 1);
        };

        const generateDefaultSongFileName = () => {
          const projectName = getters.PROJECT_NAME;
          if (projectName) {
            return projectName.split(".")[0] + ".wav";
          }

          const singer = getters.SELECTED_TRACK.singer;
          if (singer) {
            const singerName = getters.CHARACTER_INFO(
              singer.engineId,
              singer.styleId,
            )?.metas.speakerName;
            if (singerName) {
              const notes = getters.SELECTED_TRACK.notes.slice(0, 5);
              const beginningPartLyrics = notes
                .map((note) => note.lyric)
                .join("");
              return sanitizeFileName(
                `${singerName}_${beginningPartLyrics}.wav`,
              );
            }
          }

          return "Untitled.wav";
        };

        const exportWaveFile = async (): Promise<SaveResultObject> => {
          const fileName = generateDefaultSongFileName();
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
            filePath ??= await window.backend.showAudioSaveDialog({
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
            while (await window.backend.checkFileExists(filePath)) {
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
            sampleRate,
          );
          const offlineTransport = new OfflineTransport();
          const channelStrip = new ChannelStrip(offlineAudioContext);
          const limiter = withLimiter
            ? new Limiter(offlineAudioContext)
            : undefined;
          const clipper = new Clipper(offlineAudioContext);

          for (const phrase of state.phrases.values()) {
            if (
              phrase.singingGuideKey == undefined ||
              phrase.singingVoiceKey == undefined ||
              phrase.state !== "PLAYABLE"
            ) {
              continue;
            }
            const singingGuide = state.singingGuides.get(
              phrase.singingGuideKey,
            );
            const singingVoice = singingVoices.get(phrase.singingVoiceKey);
            if (!singingGuide) {
              throw new Error("singingGuide is undefined");
            }
            if (!singingVoice) {
              throw new Error("singingVoice is undefined");
            }
            // TODO: この辺りの処理を共通化する
            const audioEvents = await generateAudioEvents(
              offlineAudioContext,
              singingGuide.startTime,
              singingVoice.blob,
            );
            const audioPlayer = new AudioPlayer(offlineAudioContext);
            const audioSequence: AudioSequence = {
              type: "audio",
              audioPlayer,
              audioEvents,
            };
            audioPlayer.output.connect(channelStrip.input);
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
            await window.backend
              .writeFile({
                filePath,
                buffer: waveFileData,
              })
              .then(getValueOrThrow);
          } catch (e) {
            logger.error("Failed to exoprt the wav file.", e);
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
      },
    ),
  },

  CANCEL_AUDIO_EXPORT: {
    async action({ state, commit }) {
      if (!state.nowAudioExporting) {
        logger.warn("CANCEL_AUDIO_EXPORT on !nowAudioExporting");
        return;
      }
      commit("SET_CANCELLATION_OF_AUDIO_EXPORT_REQUESTED", {
        cancellationOfAudioExportRequested: true,
      });
    },
  },

  COPY_NOTES_TO_CLIPBOARD: {
    async action({ state, getters }) {
      const currentTrack = getters.SELECTED_TRACK;
      const noteIds = state.selectedNoteIds;
      // ノートが選択されていない場合は何もしない
      if (noteIds.size === 0) {
        return;
      }
      // 選択されたノートのみをコピーする
      const selectedNotes = currentTrack.notes
        .filter((note: Note) => noteIds.has(note.id))
        .map((note: Note) => {
          // idのみコピーしない
          const { id, ...noteWithoutId } = note;
          return noteWithoutId;
        });
      // ノートをJSONにシリアライズしてクリップボードにコピーする
      const serializedNotes = JSON.stringify(selectedNotes);
      // クリップボードにテキストとしてコピーする
      // NOTE: Electronのclipboardも使用する必要ある？
      await navigator.clipboard.writeText(serializedNotes);
      logger.info("Copied to clipboard.", serializedNotes);
    },
  },

  COMMAND_CUT_NOTES_TO_CLIPBOARD: {
    async action({ dispatch }) {
      await dispatch("COPY_NOTES_TO_CLIPBOARD");
      await dispatch("COMMAND_REMOVE_SELECTED_NOTES");
    },
  },

  COMMAND_PASTE_NOTES_FROM_CLIPBOARD: {
    async action({ commit, state, getters, dispatch }) {
      // クリップボードからテキストを読み込む
      let clipboardText;
      try {
        clipboardText = await navigator.clipboard.readText();
      } catch (error) {
        throw new Error("Failed to read the clipboard text.", {
          cause: error,
        });
      }

      // クリップボードのテキストをJSONとしてパースする(失敗した場合はエラーを返す)
      let notes;
      try {
        notes = noteSchema
          .omit({ id: true })
          .array()
          .parse(JSON.parse(clipboardText));
      } catch (error) {
        throw new Error("Failed to parse the clipboard text as JSON.", {
          cause: error,
        });
      }

      // パースしたJSONのノートの位置を現在の再生位置に合わせてクオンタイズして貼り付ける
      const currentPlayheadPosition = getters.GET_PLAYHEAD_POSITION();
      const firstNotePosition = notes[0].position;
      // TODO: クオンタイズの処理を共通化する
      const snapType = state.sequencerSnapType;
      const tpqn = state.tpqn;
      const snapTicks = getNoteDuration(snapType, tpqn);
      const notesToPaste: Note[] = notes.map((note) => {
        // 新しい位置を現在の再生位置に合わせて計算する
        const pasteOriginPos =
          Number(note.position) - firstNotePosition + currentPlayheadPosition;
        // クオンタイズ
        const quantizedPastePos =
          Math.round(pasteOriginPos / snapTicks) * snapTicks;
        return {
          id: NoteId(uuidv4()),
          position: quantizedPastePos,
          duration: Number(note.duration),
          noteNumber: Number(note.noteNumber),
          lyric: String(note.lyric),
        };
      });
      const pastedNoteIds = notesToPaste.map((note) => note.id);
      // ノートを追加してレンダリングする
      commit("COMMAND_ADD_NOTES", { notes: notesToPaste });
      dispatch("RENDER");
      // 貼り付けたノートを選択する
      commit("DESELECT_ALL_NOTES");
      commit("SELECT_NOTES", { noteIds: pastedNoteIds });
    },
  },

  COMMAND_QUANTIZE_SELECTED_NOTES: {
    action({ state, commit, getters, dispatch }) {
      const currentTrack = getters.SELECTED_TRACK;
      const selectedNotes = currentTrack.notes.filter((note: Note) => {
        return state.selectedNoteIds.has(note.id);
      });
      // TODO: クオンタイズの処理を共通化する
      const snapType = state.sequencerSnapType;
      const tpqn = state.tpqn;
      const snapTicks = getNoteDuration(snapType, tpqn);
      const quantizedNotes = selectedNotes.map((note: Note) => {
        const quantizedPosition =
          Math.round(note.position / snapTicks) * snapTicks;
        return { ...note, position: quantizedPosition };
      });
      commit("COMMAND_UPDATE_NOTES", { notes: quantizedNotes });
      dispatch("RENDER");
    },
  },
});

export const singingCommandStoreState: SingingCommandStoreState = {};

export const singingCommandStore = transformCommandStore(
  createPartialStore<SingingCommandStoreTypes>({
    COMMAND_SET_SINGER: {
      mutation(draft, { singer, withRelated }) {
        singingStore.mutations.SET_SINGER(draft, { singer, withRelated });
      },
      async action({ dispatch, commit }, { singer, withRelated }) {
        dispatch("SETUP_SINGER", { singer });
        commit("COMMAND_SET_SINGER", { singer, withRelated });

        dispatch("RENDER");
      },
    },
    COMMAND_SET_KEY_RANGE_ADJUSTMENT: {
      mutation(draft, { keyRangeAdjustment }) {
        singingStore.mutations.SET_KEY_RANGE_ADJUSTMENT(draft, {
          keyRangeAdjustment,
        });
      },
      async action(
        { dispatch, commit },
        { keyRangeAdjustment }: { keyRangeAdjustment: number },
      ) {
        if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
          throw new Error("The keyRangeAdjustment is invalid.");
        }
        commit("COMMAND_SET_KEY_RANGE_ADJUSTMENT", { keyRangeAdjustment });

        dispatch("RENDER");
      },
    },
    COMMAND_SET_VOLUME_RANGE_ADJUSTMENT: {
      mutation(draft, { volumeRangeAdjustment }) {
        singingStore.mutations.SET_VOLUME_RANGE_ADJUSTMENT(draft, {
          volumeRangeAdjustment,
        });
      },
      async action(
        { dispatch, commit },
        { volumeRangeAdjustment }: { volumeRangeAdjustment: number },
      ) {
        if (!isValidvolumeRangeAdjustment(volumeRangeAdjustment)) {
          throw new Error("The volumeRangeAdjustment is invalid.");
        }
        commit("COMMAND_SET_VOLUME_RANGE_ADJUSTMENT", {
          volumeRangeAdjustment,
        });

        dispatch("RENDER");
      },
    },
    COMMAND_SET_TEMPO: {
      mutation(draft, { tempo }) {
        singingStore.mutations.SET_TEMPO(draft, { tempo });
      },
      // テンポを設定する。既に同じ位置にテンポが存在する場合は置き換える。
      action(
        { state, getters, commit, dispatch },
        { tempo }: { tempo: Tempo },
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
        commit("COMMAND_SET_TEMPO", { tempo });
        transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

        dispatch("RENDER");
      },
    },
    COMMAND_REMOVE_TEMPO: {
      mutation(draft, { position }) {
        singingStore.mutations.REMOVE_TEMPO(draft, { position });
      },
      // テンポを削除する。先頭のテンポの場合はデフォルトのテンポに置き換える。
      action(
        { state, getters, commit, dispatch },
        { position }: { position: number },
      ) {
        const exists = state.tempos.some((value) => {
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
        commit("COMMAND_REMOVE_TEMPO", { position });
        transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

        dispatch("RENDER");
      },
    },
    COMMAND_SET_TIME_SIGNATURE: {
      mutation(draft, { timeSignature }) {
        singingStore.mutations.SET_TIME_SIGNATURE(draft, { timeSignature });
      },
      // 拍子を設定する。既に同じ位置に拍子が存在する場合は置き換える。
      action({ commit }, { timeSignature }: { timeSignature: TimeSignature }) {
        if (!isValidTimeSignature(timeSignature)) {
          throw new Error("The time signature is invalid.");
        }
        commit("COMMAND_SET_TIME_SIGNATURE", { timeSignature });
      },
    },
    COMMAND_REMOVE_TIME_SIGNATURE: {
      mutation(draft, { measureNumber }) {
        singingStore.mutations.REMOVE_TIME_SIGNATURE(draft, { measureNumber });
      },
      // 拍子を削除する。先頭の拍子の場合はデフォルトの拍子に置き換える。
      action({ state, commit }, { measureNumber }: { measureNumber: number }) {
        const exists = state.timeSignatures.some((value) => {
          return value.measureNumber === measureNumber;
        });
        if (!exists) {
          throw new Error("The time signature does not exist.");
        }
        commit("COMMAND_REMOVE_TIME_SIGNATURE", { measureNumber });
      },
    },
    COMMAND_ADD_NOTES: {
      mutation(draft, { notes }) {
        singingStore.mutations.ADD_NOTES(draft, { notes });
      },
      action({ getters, commit, dispatch }, { notes }: { notes: Note[] }) {
        const existingNoteIds = getters.NOTE_IDS;
        const isValidNotes = notes.every((value) => {
          return !existingNoteIds.has(value.id) && isValidNote(value);
        });
        if (!isValidNotes) {
          throw new Error("The notes are invalid.");
        }
        commit("COMMAND_ADD_NOTES", { notes });

        dispatch("RENDER");
      },
    },
    COMMAND_UPDATE_NOTES: {
      mutation(draft, { notes }) {
        singingStore.mutations.UPDATE_NOTES(draft, { notes });
      },
      action({ getters, commit, dispatch }, { notes }: { notes: Note[] }) {
        const existingNoteIds = getters.NOTE_IDS;
        const isValidNotes = notes.every((value) => {
          return existingNoteIds.has(value.id) && isValidNote(value);
        });
        if (!isValidNotes) {
          throw new Error("The notes are invalid.");
        }
        commit("COMMAND_UPDATE_NOTES", { notes });

        dispatch("RENDER");
      },
    },
    COMMAND_REMOVE_NOTES: {
      mutation(draft, { noteIds }) {
        singingStore.mutations.REMOVE_NOTES(draft, { noteIds });
      },
      action({ getters, commit, dispatch }, { noteIds }) {
        const existingNoteIds = getters.NOTE_IDS;
        const isValidNoteIds = noteIds.every((value) => {
          return existingNoteIds.has(value);
        });
        if (!isValidNoteIds) {
          throw new Error("The note ids are invalid.");
        }
        commit("COMMAND_REMOVE_NOTES", { noteIds });

        dispatch("RENDER");
      },
    },
    COMMAND_REMOVE_SELECTED_NOTES: {
      action({ state, commit, dispatch }) {
        commit("COMMAND_REMOVE_NOTES", { noteIds: [...state.selectedNoteIds] });

        dispatch("RENDER");
      },
    },
    COMMAND_SET_PITCH_EDIT_DATA: {
      mutation(draft, { data, startFrame }) {
        singingStore.mutations.SET_PITCH_EDIT_DATA(draft, { data, startFrame });
      },
      action(
        { commit, dispatch },
        { data, startFrame }: { data: number[]; startFrame: number },
      ) {
        if (startFrame < 0) {
          throw new Error("startFrame must be greater than or equal to 0.");
        }
        if (!isValidPitchEditData(data)) {
          throw new Error("The pitch edit data is invalid.");
        }
        commit("COMMAND_SET_PITCH_EDIT_DATA", { data, startFrame });

        dispatch("RENDER");
      },
    },
    COMMAND_ERASE_PITCH_EDIT_DATA: {
      mutation(draft, { startFrame, frameLength }) {
        singingStore.mutations.ERASE_PITCH_EDIT_DATA(draft, {
          startFrame,
          frameLength,
        });
      },
      action(
        { commit, dispatch },
        {
          startFrame,
          frameLength,
        }: { startFrame: number; frameLength: number },
      ) {
        if (startFrame < 0) {
          throw new Error("startFrame must be greater than or equal to 0.");
        }
        if (frameLength < 1) {
          throw new Error("frameLength must be at least 1.");
        }
        commit("COMMAND_ERASE_PITCH_EDIT_DATA", { startFrame, frameLength });

        dispatch("RENDER");
      },
    },
  }),
  "song",
);
