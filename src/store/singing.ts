import path from "path";
import { toRaw } from "vue";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import {
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
  PhraseSourceHash,
} from "./type";
import { sanitizeFileName } from "./utility";
import { EngineId, NoteId, StyleId } from "@/type/preload";
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
  getNoteDuration,
  isValidNote,
  isValidSnapType,
  isValidTempo,
  isValidTimeSignature,
  isValidKeyRangeAdjustment,
  isValidVolumeRangeAdjustment,
  secondToTick,
  tickToSecond,
  calculateSingingGuideSourceHash,
  calculateSingingVoiceSourceHash,
  decibelToLinear,
  applyPitchEdit,
  VALUE_INDICATING_NO_DATA,
  isValidPitchEditData,
  calculatePhraseSourceHash,
  isValidTempos,
  isValidTimeSignatures,
  isValidTpqn,
  DEFAULT_TPQN,
  DEPRECATED_DEFAULT_EDIT_FRAME_RATE,
  createDefaultTrack,
  createDefaultTempo,
  createDefaultTimeSignature,
  isValidNotes,
  SEQUENCER_MIN_NUM_MEASURES,
  getNumMeasures,
} from "@/sing/domain";
import {
  FrequentlyUpdatedState,
  getOverlappingNoteIds,
} from "@/sing/storeHelper";
import {
  AnimationTimer,
  createPromiseThatResolvesWhen,
  linearInterpolation,
  round,
} from "@/sing/utility";
import { getWorkaroundKeyRangeAdjustment } from "@/sing/workaroundKeyRangeAdjustment";
import { createLogger } from "@/domain/frontend/log";
import { noteSchema } from "@/domain/project/schema";
import { getOrThrow } from "@/helpers/mapHelper";
import { ufProjectToVoicevox } from "@/sing/utaformatixProject/toVoicevox";

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

export const singingStoreState: SingingStoreState = {
  tpqn: DEFAULT_TPQN,
  tempos: [createDefaultTempo(0)],
  timeSignatures: [createDefaultTimeSignature(1)],
  tracks: [createDefaultTrack()],
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
      if (!isValidVolumeRangeAdjustment(volumeRangeAdjustment)) {
        throw new Error("The volumeRangeAdjustment is invalid.");
      }
      commit("SET_VOLUME_RANGE_ADJUSTMENT", {
        volumeRangeAdjustment,
      });

      dispatch("RENDER");
    },
  },

  SET_TPQN: {
    mutation(state, { tpqn }: { tpqn: number }) {
      state.tpqn = tpqn;
    },
    async action(
      { state, getters, commit, dispatch },
      { tpqn }: { tpqn: number },
    ) {
      if (!isValidTpqn(tpqn)) {
        throw new Error("The tpqn is invalid.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        await dispatch("SING_STOP_AUDIO");
      }
      commit("SET_TPQN", { tpqn });
      transport.time = getters.TICK_TO_SECOND(playheadPosition.value);

      dispatch("RENDER");
    },
  },

  SET_TEMPOS: {
    mutation(state, { tempos }: { tempos: Tempo[] }) {
      state.tempos = tempos;
    },
    async action(
      { state, getters, commit, dispatch },
      { tempos }: { tempos: Tempo[] },
    ) {
      if (!isValidTempos(tempos)) {
        throw new Error("The tempos are invalid.");
      }
      if (!transport) {
        throw new Error("transport is undefined.");
      }
      if (state.nowPlaying) {
        await dispatch("SING_STOP_AUDIO");
      }
      commit("SET_TEMPOS", { tempos });
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
        tempos.splice(index, 1, createDefaultTempo(0));
      } else {
        tempos.splice(index, 1);
      }
      state.tempos = tempos;
    },
  },

  SET_TIME_SIGNATURES: {
    mutation(state, { timeSignatures }: { timeSignatures: TimeSignature[] }) {
      state.timeSignatures = timeSignatures;
    },
    async action(
      { commit, dispatch },
      { timeSignatures }: { timeSignatures: TimeSignature[] },
    ) {
      if (!isValidTimeSignatures(timeSignatures)) {
        throw new Error("The time signatures are invalid.");
      }
      commit("SET_TIME_SIGNATURES", { timeSignatures });

      dispatch("RENDER");
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
        timeSignatures.splice(index, 1, createDefaultTimeSignature(1));
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

  SET_NOTES: {
    mutation(state, { notes }: { notes: Note[] }) {
      // TODO: マルチトラック対応
      state.overlappingNoteIds.clear();
      state.editingLyricNoteId = undefined;
      state.selectedNoteIds.clear();
      state.tracks[selectedTrackIndex].notes = notes;
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.tracks[selectedTrackIndex].notes,
      );
    },
    async action({ commit, dispatch }, { notes }: { notes: Note[] }) {
      if (!isValidNotes(notes)) {
        throw new Error("The notes are invalid.");
      }
      commit("SET_NOTES", { notes });

      dispatch("RENDER");
    },
  },

  ADD_NOTES: {
    mutation(state, { notes }: { notes: Note[] }) {
      const selectedTrack = state.tracks[selectedTrackIndex];
      const newNotes = [...selectedTrack.notes, ...notes];
      newNotes.sort((a, b) => a.position - b.position);
      selectedTrack.notes = newNotes;
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.tracks[selectedTrackIndex].notes,
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
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.tracks[selectedTrackIndex].notes,
      );
    },
  },

  REMOVE_NOTES: {
    mutation(state, { noteIds }: { noteIds: NoteId[] }) {
      const noteIdsSet = new Set(noteIds);
      const selectedTrack = state.tracks[selectedTrackIndex];
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

      state.overlappingNoteIds = getOverlappingNoteIds(
        state.tracks[selectedTrackIndex].notes,
      );
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
    mutation(state, { phrases }: { phrases: Map<PhraseSourceHash, Phrase> }) {
      state.phrases = phrases;
    },
  },

  SET_STATE_TO_PHRASE: {
    mutation(
      state,
      {
        phraseKey,
        phraseState,
      }: { phraseKey: PhraseSourceHash; phraseState: PhraseState },
    ) {
      const phrase = getOrThrow(state.phrases, phraseKey);

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
        phraseKey: PhraseSourceHash;
        singingGuideKey: SingingGuideSourceHash | undefined;
      },
    ) {
      const phrase = getOrThrow(state.phrases, phraseKey);

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
        phraseKey: PhraseSourceHash;
        singingVoiceKey: SingingVoiceSourceHash | undefined;
      },
    ) {
      const phrase = getOrThrow(state.phrases, phraseKey);

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

  SEQUENCER_NUM_MEASURES: {
    getter(state) {
      // NOTE: スコア長(曲長さ)が決まっていないため、無限スクロール化する or 最後尾に足した場合は伸びるようにするなど？
      // NOTE: いったん最後尾に足した場合は伸びるようにする
      return Math.max(
        SEQUENCER_MIN_NUM_MEASURES,
        getNumMeasures(
          state.tracks[selectedTrackIndex].notes,
          state.tempos,
          state.timeSignatures,
          state.tpqn,
        ) + 1,
      );
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
      const calcPhraseFirstRestDuration = (
        prevPhraseLastNote: Note | undefined,
        phraseFirstNote: Note,
        phraseFirstRestMinDurationSeconds: number,
        tempos: Tempo[],
        tpqn: number,
      ) => {
        const quarterNoteDuration = getNoteDuration(4, tpqn);
        let phraseFirstRestDuration: number | undefined = undefined;

        // 実際のフレーズ先頭の休符の長さを調べる
        if (prevPhraseLastNote == undefined) {
          if (phraseFirstNote.position === 0) {
            // 1小節目の最初から始まっているフレーズの場合は、
            // とりあえず4分音符の長さをフレーズ先頭の休符の長さにする
            phraseFirstRestDuration = quarterNoteDuration;
          } else {
            phraseFirstRestDuration = phraseFirstNote.position;
          }
        } else {
          const prevPhraseLastNoteEndPos =
            prevPhraseLastNote.position + prevPhraseLastNote.duration;
          phraseFirstRestDuration =
            phraseFirstNote.position - prevPhraseLastNoteEndPos;
        }
        // 4分音符の長さ以下にする
        phraseFirstRestDuration = Math.min(
          phraseFirstRestDuration,
          quarterNoteDuration,
        );
        // 最小の長さ以上にする
        phraseFirstRestDuration = Math.max(
          phraseFirstRestDuration,
          phraseFirstNote.position -
            secondToTick(
              tickToSecond(phraseFirstNote.position, tempos, tpqn) -
                phraseFirstRestMinDurationSeconds,
              tempos,
              tpqn,
            ),
        );
        // 1tick以上にする
        phraseFirstRestDuration = Math.max(1, phraseFirstRestDuration);

        return phraseFirstRestDuration;
      };

      const searchPhrases = async (
        notes: Note[],
        tempos: Tempo[],
        tpqn: number,
        phraseFirstRestMinDurationSeconds: number,
      ) => {
        const foundPhrases = new Map<PhraseSourceHash, Phrase>();

        let phraseNotes: Note[] = [];
        let prevPhraseLastNote: Note | undefined = undefined;

        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          const nextNote = notes.at(i + 1);
          const currentNoteEndPos = note.position + note.duration;

          phraseNotes.push(note);

          // ノートが途切れていたら別のフレーズにする
          if (
            nextNote == undefined ||
            currentNoteEndPos !== nextNote.position
          ) {
            const phraseFirstNote = phraseNotes[0];
            const phraseFirstRestDuration = calcPhraseFirstRestDuration(
              prevPhraseLastNote,
              phraseFirstNote,
              phraseFirstRestMinDurationSeconds,
              tempos,
              tpqn,
            );
            const notesHash = await calculatePhraseSourceHash({
              firstRestDuration: phraseFirstRestDuration,
              notes: phraseNotes,
            });
            foundPhrases.set(notesHash, {
              firstRestDuration: phraseFirstRestDuration,
              notes: phraseNotes,
              state: "WAITING_TO_BE_RENDERED",
            });

            if (nextNote != undefined) {
              prevPhraseLastNote = phraseNotes.at(-1);
              phraseNotes = [];
            }
          }
        }
        return foundPhrases;
      };

      // リクエスト用のノーツ（と休符）を作成する
      const createNotesForRequestToEngine = (
        firstRestDuration: number,
        lastRestDurationSeconds: number,
        notes: Note[],
        tempos: Tempo[],
        tpqn: number,
        frameRate: number,
      ) => {
        const notesForRequestToEngine: NoteForRequestToEngine[] = [];

        // 先頭の休符を変換
        const firstRestStartSeconds = tickToSecond(
          notes[0].position - firstRestDuration,
          tempos,
          tpqn,
        );
        const firstRestStartFrame = Math.round(
          firstRestStartSeconds * frameRate,
        );
        const firstRestEndSeconds = tickToSecond(
          notes[0].position,
          tempos,
          tpqn,
        );
        const firstRestEndFrame = Math.round(firstRestEndSeconds * frameRate);
        notesForRequestToEngine.push({
          key: undefined,
          frameLength: firstRestEndFrame - firstRestStartFrame,
          lyric: "",
        });

        // ノートを変換
        for (const note of notes) {
          const noteOnSeconds = tickToSecond(note.position, tempos, tpqn);
          const noteOnFrame = Math.round(noteOnSeconds * frameRate);
          const noteOffSeconds = tickToSecond(
            note.position + note.duration,
            tempos,
            tpqn,
          );
          const noteOffFrame = Math.round(noteOffSeconds * frameRate);
          notesForRequestToEngine.push({
            key: note.noteNumber,
            frameLength: noteOffFrame - noteOnFrame,
            lyric: note.lyric,
          });
        }

        // 末尾に休符を追加
        const lastRestFrameLength = Math.round(
          lastRestDurationSeconds * frameRate,
        );
        notesForRequestToEngine.push({
          key: undefined,
          frameLength: lastRestFrameLength,
          lyric: "",
        });

        // frameLengthが1以上になるようにする
        for (let i = 0; i < notesForRequestToEngine.length; i++) {
          const frameLength = notesForRequestToEngine[i].frameLength;
          const frameToShift = Math.max(0, 1 - frameLength);
          notesForRequestToEngine[i].frameLength += frameToShift;
          if (i < notesForRequestToEngine.length - 1) {
            notesForRequestToEngine[i + 1].frameLength -= frameToShift;
          }
        }

        return notesForRequestToEngine;
      };

      const shiftKeyOfNotes = (
        notes: NoteForRequestToEngine[],
        keyShift: number,
      ) => {
        for (const note of notes) {
          if (note.key != undefined) {
            note.key += keyShift;
          }
        }
      };

      const singingTeacherStyleId = StyleId(6000); // TODO: 設定できるようにする

      const fetchQuery = async (
        engineId: EngineId,
        notesForRequestToEngine: NoteForRequestToEngine[],
      ) => {
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
        frameAudioQuery: FrameAudioQuery,
        pitchShift: number,
      ) => {
        frameAudioQuery.f0 = frameAudioQuery.f0.map((value) => {
          return value * Math.pow(2, pitchShift / 12);
        });
      };

      const shiftGuideVolume = (
        frameAudioQuery: FrameAudioQuery,
        volumeShift: number,
      ) => {
        frameAudioQuery.volume = frameAudioQuery.volume.map((value) => {
          return value * decibelToLinear(volumeShift);
        });
      };

      // 歌とpauの呼吸音が重ならないようにvolumeを制御する
      // fadeOutDurationSecondsが0の場合は即座にvolumeを0にする
      const muteLastPauSection = (
        frameAudioQuery: FrameAudioQuery,
        frameRate: number,
        fadeOutDurationSeconds: number,
      ) => {
        const lastPhoneme = frameAudioQuery.phonemes.at(-1);
        if (lastPhoneme == undefined || lastPhoneme.phoneme !== "pau") {
          throw new Error("No pau exists at the end.");
        }

        let lastPauStartFrame = 0;
        for (let i = 0; i < frameAudioQuery.phonemes.length - 1; i++) {
          lastPauStartFrame += frameAudioQuery.phonemes[i].frameLength;
        }

        const lastPauFrameLength = lastPhoneme.frameLength;
        let fadeOutFrameLength = Math.round(fadeOutDurationSeconds * frameRate);
        fadeOutFrameLength = Math.max(0, fadeOutFrameLength);
        fadeOutFrameLength = Math.min(lastPauFrameLength, fadeOutFrameLength);

        // フェードアウト処理を行う
        if (fadeOutFrameLength === 1) {
          frameAudioQuery.volume[lastPauStartFrame] *= 0.5;
        } else {
          for (let i = 0; i < fadeOutFrameLength; i++) {
            frameAudioQuery.volume[lastPauStartFrame + i] *=
              linearInterpolation(0, 1, fadeOutFrameLength - 1, 0, i);
          }
        }
        // 音量を0にする
        for (let i = fadeOutFrameLength; i < lastPauFrameLength; i++) {
          frameAudioQuery.volume[lastPauStartFrame + i] = 0;
        }
      };

      const calculateStartTime = (
        phrase: Phrase,
        tempos: Tempo[],
        tpqn: number,
      ) => {
        return tickToSecond(
          phrase.notes[0].position - phrase.firstRestDuration,
          tempos,
          tpqn,
        );
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
        const firstRestMinDurationSeconds = 0.12;
        const lastRestDurationSeconds = 0.5;
        const fadeOutDurationSeconds = 0.15;

        // フレーズを更新する

        const foundPhrases = await searchPhrases(
          notes,
          tempos,
          tpqn,
          firstRestMinDurationSeconds,
        );

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

        const phrases = new Map<PhraseSourceHash, Phrase>();

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
                firstRestDuration: phrase.firstRestDuration,
                lastRestDurationSeconds,
                notes: phrase.notes,
                keyRangeAdjustment,
                volumeRangeAdjustment,
                frameRate: singerAndFrameRate.frameRate,
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
              let singingGuide = getOrThrow(
                state.singingGuides,
                phrase.singingGuideKey,
              );

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
            // リクエスト（クエリ生成と音量生成）用のノーツを作る
            const notesForRequestToEngine = createNotesForRequestToEngine(
              phrase.firstRestDuration,
              lastRestDurationSeconds,
              phrase.notes,
              tempos,
              tpqn,
              singerAndFrameRate.frameRate,
            );

            // リクエスト用のノーツのキーのシフトを行う
            shiftKeyOfNotes(notesForRequestToEngine, -keyRangeAdjustment);

            // 歌い方が存在する場合、歌い方を取得する
            // 歌い方が存在しない場合、キャッシュがあれば取得し、なければ歌い方を生成する

            let singingGuide: SingingGuide | undefined;
            if (phrase.singingGuideKey != undefined) {
              singingGuide = getOrThrow(
                state.singingGuides,
                phrase.singingGuideKey,
              );
            } else {
              const singingGuideSourceHash =
                await calculateSingingGuideSourceHash({
                  engineId: singerAndFrameRate.singer.engineId,
                  tpqn,
                  tempos,
                  firstRestDuration: phrase.firstRestDuration,
                  lastRestDurationSeconds,
                  notes: phrase.notes,
                  keyRangeAdjustment,
                  volumeRangeAdjustment,
                  frameRate: singerAndFrameRate.frameRate,
                });

              const singingGuideKey = singingGuideSourceHash;
              const cachedSingingGuide = singingGuideCache.get(singingGuideKey);
              if (cachedSingingGuide) {
                singingGuide = cachedSingingGuide;

                logger.info(`Loaded singing guide from cache.`);
              } else {
                // クエリを生成する
                const query = await fetchQuery(
                  singerAndFrameRate.singer.engineId,
                  notesForRequestToEngine,
                );

                const phonemes = getPhonemes(query);
                logger.info(`Fetched frame audio query. phonemes: ${phonemes}`);

                // ピッチのシフトを行う
                shiftGuidePitch(query, keyRangeAdjustment);

                // フレーズの開始時刻を計算する
                const startTime = calculateStartTime(phrase, tempos, tpqn);

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
              // f0をもう一度シフトして、元の（クエリ生成時の）高さに戻す
              const queryForVolumeGeneration = structuredClone(
                singingGuide.query,
              );
              shiftGuidePitch(queryForVolumeGeneration, -keyRangeAdjustment);

              // 音量を生成して、生成した音量を歌い方のクエリにセットする
              // 音量値はAPIを叩く毎に変わるので、calc hashしたあとに音量を取得している
              const volumes = await dispatch("FETCH_SING_FRAME_VOLUME", {
                notes: notesForRequestToEngine,
                frameAudioQuery: queryForVolumeGeneration,
                styleId: singingTeacherStyleId,
                engineId: singerAndFrameRate.singer.engineId,
              });
              singingGuide.query.volume = volumes;

              // 音量のシフトを行う
              shiftGuideVolume(singingGuide.query, volumeRangeAdjustment);

              // 末尾のpauの区間の音量を0にする
              muteLastPauSection(
                singingGuide.query,
                singerAndFrameRate.frameRate,
                fadeOutDurationSeconds,
              );

              // 音声合成を行う
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

  // TODO: Undoできるようにする
  IMPORT_UTAFORMATIX_PROJECT: {
    action: createUILockAction(
      async ({ state, commit, dispatch }, { project, trackIndex = 0 }) => {
        const { tempos, timeSignatures, tracks, tpqn } =
          ufProjectToVoicevox(project);

        const notes = tracks[trackIndex].notes;

        if (tempos.length > 1) {
          logger.warn("Multiple tempos are not supported.");
        }
        if (timeSignatures.length > 1) {
          logger.warn("Multiple time signatures are not supported.");
        }

        tempos.splice(1, tempos.length - 1); // TODO: 複数テンポに対応したら削除
        timeSignatures.splice(1, timeSignatures.length - 1); // TODO: 複数拍子に対応したら削除

        if (tpqn !== state.tpqn) {
          throw new Error("TPQN does not match. Must be converted.");
        }

        // TODO: ここら辺のSET系の処理をまとめる
        await dispatch("SET_TPQN", { tpqn });
        await dispatch("SET_TEMPOS", { tempos });
        await dispatch("SET_TIME_SIGNATURES", { timeSignatures });
        await dispatch("SET_NOTES", { notes });

        commit("SET_SAVED_LAST_COMMAND_UNIX_MILLISEC", null);
        commit("CLEAR_COMMANDS");
        dispatch("RENDER");
      },
    ),
  },

  // TODO: Undoできるようにする
  IMPORT_VOICEVOX_PROJECT: {
    action: createUILockAction(
      async ({ state, commit, dispatch }, { project, trackIndex = 0 }) => {
        const { tempos, timeSignatures, tracks, tpqn } = project.song;

        const track = tracks[trackIndex];
        const notes = track.notes.map((note) => ({
          ...note,
          id: NoteId(crypto.randomUUID()),
        }));

        if (tpqn !== state.tpqn) {
          throw new Error("TPQN does not match. Must be converted.");
        }

        // TODO: ここら辺のSET系の処理をまとめる
        await dispatch("SET_SINGER", {
          singer: track.singer,
        });
        await dispatch("SET_KEY_RANGE_ADJUSTMENT", {
          keyRangeAdjustment: track.keyRangeAdjustment,
        });
        await dispatch("SET_VOLUME_RANGE_ADJUSTMENT", {
          volumeRangeAdjustment: track.volumeRangeAdjustment,
        });
        await dispatch("SET_TPQN", { tpqn });
        await dispatch("SET_TEMPOS", { tempos });
        await dispatch("SET_TIME_SIGNATURES", { timeSignatures });
        await dispatch("SET_NOTES", { notes });
        await dispatch("CLEAR_PITCH_EDIT_DATA"); // FIXME: SET_PITCH_EDIT_DATAがセッターになれば不要
        await dispatch("SET_PITCH_EDIT_DATA", {
          data: track.pitchEditData,
          startFrame: 0,
        });

        commit("SET_SAVED_LAST_COMMAND_UNIX_MILLISEC", null);
        commit("CLEAR_COMMANDS");
        dispatch("RENDER");
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
            const singingGuide = getOrThrow(
              state.singingGuides,
              phrase.singingGuideKey,
            );
            const singingVoice = getOrThrow(
              singingVoices,
              phrase.singingVoiceKey,
            );

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
          id: NoteId(crypto.randomUUID()),
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
        if (!isValidVolumeRangeAdjustment(volumeRangeAdjustment)) {
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
