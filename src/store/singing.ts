import path from "path";
import { v4 as uuidv4 } from "uuid";
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
  transformCommandStore,
  Track,
  SingingGuide,
  SingingVoice,
  SingingGuideSourceHash,
  SingingVoiceSourceHash,
  SequencerEditTarget,
  PhraseSourceHash,
} from "./type";
import { sanitizeFileName } from "./utility";
import { EngineId, TrackId, NoteId, StyleId } from "@/type/preload";
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
  isValidSnapType,
  isValidTempo,
  isValidTimeSignature,
  isValidKeyRangeAdjustment,
  isValidVolumeRangeAdjustment,
  secondToTick,
  tickToSecond,
  shouldPlay,
  calcRenderDuration,
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
} from "@/sing/domain";
import {
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
  linearInterpolation,
  round,
} from "@/sing/utility";
import { generateWriteErrorMessage } from "@/helpers/generateWriteErrorMessage";
import DefaultMap from "@/helpers/DefaultMap";
import { getWorkaroundKeyRangeAdjustment } from "@/sing/workaroundKeyRangeAdjustment";
import { noteSchema } from "@/domain/project/schema";
import { createLogger } from "@/domain/frontend/log";
import { convertToWavFileData } from "@/sing/waveExport";
import { getOrThrow } from "@/helpers/mapHelper";

const logger = createLogger("store/singing");

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

const generateAudioEvents = async (
  audioContext: BaseAudioContext,
  time: number,
  blob: Blob,
): Promise<AudioEvent[]> => {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(arrayBuffer);
  return [{ time, buffer }];
};

let audioContext: AudioContext | undefined;
let transport: Transport | undefined;
let previewSynth: PolySynth | undefined;
let previewChannelStrip: ChannelStrip | undefined;
let globalChannelStrip: ChannelStrip | undefined;

// Undoしたときに不明なトラックを参照してしまうので、DefaultMapを使う。
// TODO: 通常のMapに変更する
const channelStrips = new DefaultMap<TrackId, ChannelStrip>(() => {
  if (!audioContext) {
    throw new Error("audioContext is undefined.");
  }
  const strip = new ChannelStrip(audioContext);
  if (!globalChannelStrip) {
    throw new Error("globalChannelStrip is undefined.");
  }
  strip.output.connect(globalChannelStrip.input);
  return strip;
});

let limiter: Limiter | undefined;
let clipper: Clipper | undefined;

// NOTE: テスト時はAudioContextが存在しない
if (window.AudioContext) {
  audioContext = new AudioContext();
  transport = new Transport(audioContext);
  previewSynth = new PolySynth(audioContext);
  previewChannelStrip = new ChannelStrip(audioContext);
  globalChannelStrip = new ChannelStrip(audioContext);
  limiter = new Limiter(audioContext);
  clipper = new Clipper(audioContext);

  previewSynth.output.connect(previewChannelStrip.input);
  previewChannelStrip.output.connect(globalChannelStrip.input);
  globalChannelStrip.output.connect(limiter.input);
  limiter.output.connect(clipper.input);
  clipper.output.connect(audioContext.destination);
}

const playheadPosition = new FrequentlyUpdatedState(0);
const singingVoices = new Map<SingingVoiceSourceHash, SingingVoice>();
const sequences = new Map<string, Sequence>(); // キーはPhraseKey
const animationTimer = new AnimationTimer();

const singingGuideCache = new Map<SingingGuideSourceHash, SingingGuide>();
const singingVoiceCache = new Map<SingingVoiceSourceHash, SingingVoice>();

const updateTrackMute = (shouldPlay: Record<TrackId, boolean>) => {
  for (const [trackId, channelStrip] of channelStrips) {
    channelStrip.mute = !shouldPlay[trackId];
  }
};

const initialTrackId = TrackId(uuidv4());

export const singingStoreState: SingingStoreState = {
  tpqn: DEFAULT_TPQN,
  tempos: [createDefaultTempo(0)],
  timeSignatures: [createDefaultTimeSignature(1)],
  tracks: new Map([[initialTrackId, createDefaultTrack()]]),
  trackOrder: [initialTrackId],
  selectedTrackId: initialTrackId,
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
  overlappingNoteInfos: new Map([[initialTrackId, new Map()]]),
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
    mutation(state, { trackId, singer, withRelated }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("Track is not found.");
      }

      track.singer = singer;

      if (withRelated == true && singer != undefined) {
        // 音域調整量マジックナンバーを設定するワークアラウンド
        const keyRangeAdjustment = getWorkaroundKeyRangeAdjustment(
          state.characterInfos,
          singer,
        );
        track.keyRangeAdjustment = keyRangeAdjustment;
      }
    },
    async action(
      { state, getters, dispatch, commit },
      { trackId, singer, withRelated },
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
      commit("SET_SINGER", {
        trackId,
        singer: { engineId, styleId },
        withRelated,
      });

      dispatch("RENDER");
    },
  },

  SET_KEY_RANGE_ADJUSTMENT: {
    mutation(state, { keyRangeAdjustment, trackId }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("Track is not found.");
      }

      track.keyRangeAdjustment = keyRangeAdjustment;
    },
    async action({ dispatch, commit }, { keyRangeAdjustment, trackId }) {
      if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
        throw new Error("The keyRangeAdjustment is invalid.");
      }

      commit("SET_KEY_RANGE_ADJUSTMENT", { trackId, keyRangeAdjustment });

      dispatch("RENDER");
    },
  },

  SET_VOLUME_RANGE_ADJUSTMENT: {
    mutation(state, { volumeRangeAdjustment, trackId }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("Track is not found.");
      }

      track.volumeRangeAdjustment = volumeRangeAdjustment;
    },
    async action({ dispatch, commit }, { volumeRangeAdjustment, trackId }) {
      if (!isValidVolumeRangeAdjustment(volumeRangeAdjustment)) {
        throw new Error("The volumeRangeAdjustment is invalid.");
      }
      commit("SET_VOLUME_RANGE_ADJUSTMENT", {
        volumeRangeAdjustment,
        trackId,
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
      const selectedTrack = state.tracks.get(state.selectedTrackId);
      if (selectedTrack == undefined) {
        throw new Error("selectedTrack is undefined.");
      }

      const noteIds = selectedTrack.notes.map((value) => value.id);
      return new Set(noteIds);
    },
  },

  SET_NOTES: {
    mutation(state, { notes, trackId }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("track is undefined.");
      }
      state.overlappingNoteIds.clear();
      state.editingLyricNoteId = undefined;
      state.selectedNoteIds.clear();
      track.notes = notes;

      const overlappingNoteInfos = state.overlappingNoteInfos.get(trackId);
      if (overlappingNoteInfos == undefined) {
        throw new Error("overlappingNoteInfos is undefined.");
      }
      overlappingNoteInfos.clear();
      addNotesToOverlappingNoteInfos(overlappingNoteInfos, notes);
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos,
      );
    },
    async action({ commit, dispatch }, { notes, trackId }) {
      if (!isValidNotes(notes)) {
        throw new Error("The notes are invalid.");
      }
      commit("SET_NOTES", { notes, trackId });

      dispatch("RENDER");
    },
  },

  ADD_NOTES: {
    mutation(state, { notes }: { notes: Note[] }) {
      const selectedTrack = state.tracks.get(state.selectedTrackId);
      if (selectedTrack == undefined) {
        throw new Error("selectedTrack is undefined.");
      }

      const newNotes = [...selectedTrack.notes, ...notes];
      newNotes.sort((a, b) => a.position - b.position);
      selectedTrack.notes = newNotes;
      const overlappingNoteInfo = state.overlappingNoteInfos.get(
        state.selectedTrackId,
      );
      if (overlappingNoteInfo == undefined) {
        throw new Error("overlappingNoteInfo is undefined.");
      }
      addNotesToOverlappingNoteInfos(overlappingNoteInfo, notes);
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

      const selectedTrack = state.tracks.get(state.selectedTrackId);
      if (selectedTrack == undefined) {
        throw new Error("selectedTrack is undefined.");
      }

      selectedTrack.notes = selectedTrack.notes
        .map((value) => notesMap.get(value.id) ?? value)
        .sort((a, b) => a.position - b.position);

      const overlappingNoteInfo = state.overlappingNoteInfos.get(
        state.selectedTrackId,
      );
      if (overlappingNoteInfo == undefined) {
        throw new Error("overlappingNoteInfo is undefined.");
      }

      updateNotesOfOverlappingNoteInfos(overlappingNoteInfo, notes);
      state.overlappingNoteIds = getOverlappingNoteIds(
        state.overlappingNoteInfos,
      );
    },
  },

  REMOVE_NOTES: {
    mutation(state, { noteIds }: { noteIds: NoteId[] }) {
      const noteIdsSet = new Set(noteIds);
      const selectedTrack = state.tracks.get(state.selectedTrackId);
      if (selectedTrack == undefined) {
        throw new Error("selectedTrack is undefined.");
      }

      const notes = selectedTrack.notes.filter((value) => {
        return noteIdsSet.has(value.id);
      });

      const overlappingNoteInfo = state.overlappingNoteInfos.get(
        state.selectedTrackId,
      );
      if (overlappingNoteInfo == undefined) {
        throw new Error("overlappingNoteInfo is undefined.");
      }

      removeNotesFromOverlappingNoteInfos(overlappingNoteInfo, notes);
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
      const selectedTrack = state.tracks.get(state.selectedTrackId);
      if (selectedTrack == undefined) {
        throw new Error("selectedTrack is undefined.");
      }

      const allNoteIds = selectedTrack.notes.map((note) => note.id);
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
    mutation(state, { data, trackId, startFrame }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("track is undefined.");
      }

      const pitchEditData = track.pitchEditData;
      const tempData = [...pitchEditData];
      const endFrame = startFrame + data.length;
      if (tempData.length < endFrame) {
        const valuesToPush = new Array(endFrame - tempData.length).fill(
          VALUE_INDICATING_NO_DATA,
        );
        tempData.push(...valuesToPush);
      }
      tempData.splice(startFrame, data.length, ...data);
      track.pitchEditData = tempData;
    },
    async action({ dispatch, commit }, { data, startFrame, trackId }) {
      if (startFrame < 0) {
        throw new Error("startFrame must be greater than or equal to 0.");
      }
      if (!isValidPitchEditData(data)) {
        throw new Error("The pitch edit data is invalid.");
      }
      commit("SET_PITCH_EDIT_DATA", { data, startFrame, trackId });

      dispatch("RENDER");
    },
  },

  ERASE_PITCH_EDIT_DATA: {
    mutation(state, { startFrame, frameLength, trackId }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("track is undefined.");
      }

      const pitchEditData = track.pitchEditData;
      const tempData = [...pitchEditData];
      const endFrame = Math.min(startFrame + frameLength, tempData.length);
      tempData.fill(VALUE_INDICATING_NO_DATA, startFrame, endFrame);
      track.pitchEditData = tempData;
    },
  },

  CLEAR_PITCH_EDIT_DATA: {
    // ピッチ編集データを失くす。
    mutation(state, { trackId }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("track is undefined.");
      }

      track.pitchEditData = [];
    },
    async action({ dispatch, commit }, { trackId }) {
      commit("CLEAR_PITCH_EDIT_DATA", { trackId });

      dispatch("RENDER");
    },
  },

  SET_PHRASES: {
    mutation(state, { phrases }) {
      state.phrases = structuredClone(toRaw(phrases));
    },
  },

  SET_STATE_TO_PHRASE: {
    mutation(state, { phraseKey, phraseState, trackId }) {
      const phrase = state.phrases.get(trackId)?.get(phraseKey);
      if (phrase == undefined) {
        throw new Error("phrase is undefined.");
      }

      phrase.state = phraseState;
    },
  },

  SET_SINGING_GUIDE_KEY_TO_PHRASE: {
    mutation(state, { phraseKey, singingGuideKey, trackId }) {
      const phrase = state.phrases.get(trackId)?.get(phraseKey);
      if (phrase == undefined) {
        throw new Error("phrase is undefined.");
      }

      phrase.singingGuideKey = singingGuideKey;
    },
  },

  SET_SINGING_VOICE_KEY_TO_PHRASE: {
    mutation(state, { phraseKey, singingVoiceKey, trackId }) {
      const phrase = state.phrases.get(trackId)?.get(phraseKey);
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

  SET_SELECTED_TRACK: {
    mutation(state, { trackId }: { trackId: TrackId }) {
      state.selectedTrackId = trackId;
      state.selectedNoteIds.clear();
    },
    async action({ commit }, { trackId }) {
      commit("SET_SELECTED_TRACK", { trackId });
    },
  },

  SELECTED_TRACK: {
    getter(state) {
      const selectedTrack = state.tracks.get(state.selectedTrackId);
      if (selectedTrack == undefined) {
        throw new Error("selectedTrack is undefined.");
      }

      return selectedTrack;
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
      if (!globalChannelStrip) {
        throw new Error("globalChannelStrip is undefined.");
      }
      globalChannelStrip.volume = volume;
    },
    async action({ commit }, { volume }) {
      commit("SET_VOLUME", { volume });
    },
  },

  PLAY_PREVIEW_SOUND: {
    async action(
      { getters },
      { noteNumber, duration }: { noteNumber: number; duration?: number },
    ) {
      if (!previewSynth || !previewChannelStrip) {
        throw new Error("previewSynth or previewChannelStrip is undefined.");
      }
      const selectedTrack = getters.SELECTED_TRACK;
      previewChannelStrip.volume = selectedTrack.volume;
      previewChannelStrip.pan = selectedTrack.pan;
      previewSynth.noteOn("immediately", noteNumber, duration);
    },
  },

  STOP_PREVIEW_SOUND: {
    async action({ getters }, { noteNumber }: { noteNumber: number }) {
      if (!previewSynth || !previewChannelStrip) {
        throw new Error("previewSynth or previewChannelStrip is undefined.");
      }
      const selectedTrack = getters.SELECTED_TRACK;
      previewChannelStrip.volume = selectedTrack.volume;
      previewChannelStrip.pan = selectedTrack.pan;
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
        if (!globalChannelStrip) {
          throw new Error("globalChannelStrip is undefined.");
        }
        const audioContextRef = audioContext;
        const transportRef = transport;
        const globalChannelStripRef = globalChannelStrip;

        // レンダリング中に変更される可能性のあるデータをコピーする
        // 重なっているノートの削除も行う
        const tpqn = state.tpqn;
        const tempos = state.tempos.map((value) => ({ ...value }));
        const foundPhrases = new Map<
          `${TrackId}:${PhraseSourceHash}`,
          Phrase
        >();
        const tracks = structuredClone(toRaw(state.tracks));

        const editFrameRate = state.editFrameRate;
        const firstRestMinDurationSeconds = 0.12;
        const lastRestDurationSeconds = 0.5;
        const fadeOutDurationSeconds = 0.15;

        for (const [trackId, track] of tracks) {
          const notes = track.notes
            .map((value) => ({ ...value }))
            .filter((value) => !state.overlappingNoteIds.has(value.id));

          // フレーズを更新する
          const foundPhrasesInTrack = await searchPhrases(
            notes,
            tempos,
            tpqn,
            firstRestMinDurationSeconds,
          );
          for (const [phraseKey, phrase] of foundPhrasesInTrack) {
            foundPhrases.set(`${trackId}:${phraseKey}`, phrase);
          }
        }

        for (const [trackId, phrases] of state.phrases) {
          for (const [phraseKey, phrase] of phrases) {
            const notesHash = phraseKey;
            if (!foundPhrases.has(`${trackId}:${notesHash}`)) {
              // 歌い方と歌声を削除する
              if (phrase.singingGuideKey != undefined) {
                commit("DELETE_SINGING_GUIDE", {
                  singingGuideKey: phrase.singingGuideKey,
                  trackId,
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
        }

        const newPhrases = new DefaultMap<
          TrackId,
          Map<PhraseSourceHash, Phrase>
        >(() => new Map());

        for (const [foundPhraseKey, foundPhrase] of foundPhrases) {
          const [trackId_, phraseKey_] = foundPhraseKey.split(":");
          const trackId = TrackId(trackId_);
          const phraseKey = PhraseSourceHash(phraseKey_);
          const existingPhrase = newPhrases.get(trackId).get(phraseKey);
          if (!existingPhrase) {
            // 新しいフレーズの場合
            newPhrases.get(trackId).set(phraseKey, foundPhrase);
            continue;
          }

          // すでに存在するフレーズの場合
          // 再レンダリングする必要があるかどうかをチェックする
          // シンガーが未設定の場合、とりあえず常に再レンダリングする
          // 音声合成を行う必要がある場合、現在フレーズに設定されている歌声を削除する
          // 歌い方の推論も行う必要がある場合、現在フレーズに設定されている歌い方を削除する
          // TODO: リファクタリングする
          const phrase = structuredClone(toRaw(existingPhrase));

          const trackRef = tracks.get(trackId);

          if (trackRef == undefined) {
            logger.warn("Track not found.");
            continue;
          }

          const singerAndFrameRate = trackRef.singer
            ? {
                singer: { ...trackRef.singer },
                frameRate:
                  state.engineManifests[trackRef.singer.engineId].frameRate,
              }
            : undefined;
          const keyRangeAdjustment = trackRef.keyRangeAdjustment;
          const volumeRangeAdjustment = trackRef.volumeRangeAdjustment;
          const pitchEditData = trackRef.pitchEditData;

          if (!singerAndFrameRate || phrase.state === "COULD_NOT_RENDER") {
            if (phrase.singingGuideKey != undefined) {
              commit("DELETE_SINGING_GUIDE", {
                singingGuideKey: phrase.singingGuideKey,
                trackId,
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
                  trackId,
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

          newPhrases.get(trackId).set(phraseKey, phrase);
        }

        commit("SET_PHRASES", { phrases: newPhrases });

        logger.info("Phrases updated.");

        // 各フレーズのレンダリングを行う

        const phrasesToBeRendered = new Map(
          [...state.phrases.entries()]
            .flatMap(([trackId, phrases]) =>
              [...phrases.entries()].map(([phraseKey, phrase]) => ({
                trackId,
                phraseKey,
                phrase,
              })),
            )
            .filter(({ phrase }) => {
              return phrase.state === "WAITING_TO_BE_RENDERED";
            })
            .map(({ trackId, phraseKey, phrase }) => [
              `${trackId}:${phraseKey}`,
              phrase,
            ]),
        );
        for (const [trackIdAndPhraseKey, phrase] of phrasesToBeRendered) {
          // シーケンスが存在する場合、シーケンスの接続を解除して削除する
          // TODO: ピッチを編集したときは行わないようにする

          const [, phraseKey] = trackIdAndPhraseKey.split(":");

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
            polySynth.output.connect(globalChannelStripRef.input);
            transportRef.addSequence(noteSequence);
            sequences.set(phraseKey, noteSequence);
          }
        }
        while (phrasesToBeRendered.size > 0) {
          if (startRenderingRequested() || stopRenderingRequested()) {
            return;
          }
          const [trackIdAndPhraseKey, phrase] = selectPriorPhrase(
            phrasesToBeRendered,
            playheadPosition.value,
          );
          phrasesToBeRendered.delete(trackIdAndPhraseKey);
          const [trackId_, phraseKey_] = trackIdAndPhraseKey.split(":");
          const trackId = TrackId(trackId_);
          const phraseKey = PhraseSourceHash(phraseKey_);

          const trackRef = tracks.get(trackId);
          if (trackRef == undefined) {
            logger.warn("Track not found.");
            continue;
          }

          const singerAndFrameRate = trackRef.singer
            ? {
                singer: { ...trackRef.singer },
                frameRate:
                  state.engineManifests[trackRef.singer.engineId].frameRate,
              }
            : undefined;
          const keyRangeAdjustment = trackRef.keyRangeAdjustment;
          const volumeRangeAdjustment = trackRef.volumeRangeAdjustment;
          const pitchEditData = trackRef.pitchEditData;

          // シンガーが未設定の場合は、歌い方の生成や音声合成は行わない

          if (!singerAndFrameRate) {
            commit("SET_STATE_TO_PHRASE", {
              trackId,
              phraseKey,
              phraseState: "PLAYABLE",
            });
            continue;
          }

          commit("SET_STATE_TO_PHRASE", {
            trackId,
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
              commit("SET_SINGING_GUIDE", {
                singingGuideKey,
                singingGuide,
                trackId,
              });
              commit("SET_SINGING_GUIDE_KEY_TO_PHRASE", {
                phraseKey,
                singingGuideKey,
                trackId,
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
              trackId,
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

            audioPlayer.output.connect(channelStrips.get(trackId).input);
            transportRef.addSequence(audioSequence);
            sequences.set(phraseKey, audioSequence);

            commit("SET_STATE_TO_PHRASE", {
              phraseKey,
              phraseState: "PLAYABLE",
              trackId,
            });
          } catch (error) {
            commit("SET_STATE_TO_PHRASE", {
              phraseKey,
              phraseState: "COULD_NOT_RENDER",
              trackId,
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
        { getters, commit, dispatch, state },
        { filePath, trackIndex = 0 }: { filePath: string; trackIndex: number },
      ) => {
        const currentSinger = getters.SELECTED_TRACK.singer;
        if (!currentSinger) {
          throw new Error("Singer is not set.");
        }

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
        tempos.unshift(createDefaultTempo(0));
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
        timeSignatures.unshift(createDefaultTimeSignature(1));
        timeSignatures = removeDuplicateTimeSignatures(timeSignatures);

        if (tpqn !== state.tpqn) {
          throw new Error("TPQN does not match. Must be converted.");
        }
        await dispatch("SET_TEMPOS", { tempos });
        await dispatch("SET_TIME_SIGNATURES", { timeSignatures });

        if (getters.SELECTED_TRACK.notes.length > 0) {
          const trackId = TrackId(uuidv4());
          // singerにProxyを渡すとバグるので、toRawでProxyを取り除く
          commit("CREATE_TRACK", {
            singer: structuredClone(toRaw(currentSinger)),
            trackId,
          });
        }
        await dispatch("SET_NOTES", {
          notes,
          trackId: state.selectedTrackId,
        });

        dispatch("RENDER");
      },
    ),
  },

  IMPORT_MUSICXML_FILE: {
    action: createUILockAction(
      async (
        { dispatch, getters, state, commit },
        { filePath }: { filePath?: string },
      ) => {
        if (!filePath) {
          filePath = await window.backend.showImportFileDialog({
            title: "MusicXML読み込み",
            name: "MusicXML",
            extensions: ["musicxml", "xml"],
          });
          if (!filePath) return;
        }
        const currentSinger = getters.SELECTED_TRACK.singer;
        if (!currentSinger) {
          throw new Error("Singer is not set.");
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
        const tempos = [createDefaultTempo(0)];
        const timeSignatures = [createDefaultTimeSignature(1)];
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

        if (tpqn !== state.tpqn) {
          throw new Error("TPQN does not match. Must be converted.");
        }
        await dispatch("SET_TEMPOS", { tempos });
        await dispatch("SET_TIME_SIGNATURES", { timeSignatures });

        if (getters.SELECTED_TRACK.notes.length > 0) {
          const trackId = TrackId(uuidv4());
          // singerにProxyを渡すとバグるので、toRawでProxyを取り除く
          commit("CREATE_TRACK", {
            singer: structuredClone(toRaw(currentSinger)),
            trackId,
          });
        }
        await dispatch("SET_NOTES", { notes, trackId: state.selectedTrackId });
      },
    ),
  },

  IMPORT_UST_FILE: {
    action: createUILockAction(
      async (
        { dispatch, state, getters, commit },
        { filePath }: { filePath?: string },
      ) => {
        const currentSinger = getters.SELECTED_TRACK.singer;
        if (!currentSinger) {
          throw new Error("Singer is not set.");
        }

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
        const tempos = [createDefaultTempo(0)];
        const timeSignatures = [createDefaultTimeSignature(1)];
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

        if (tpqn !== state.tpqn) {
          throw new Error("TPQN does not match. Must be converted.");
        }
        await dispatch("SET_TEMPOS", { tempos });
        await dispatch("SET_TIME_SIGNATURES", { timeSignatures });

        if (getters.SELECTED_TRACK.notes.length > 0) {
          const trackId = TrackId(uuidv4());
          // singerにProxyを渡すとバグるので、toRawでProxyを取り除く
          commit("CREATE_TRACK", {
            singer: structuredClone(toRaw(currentSinger)),
            trackId,
          });
        }
        await dispatch("SET_NOTES", { notes, trackId: state.selectedTrackId });
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

          const renderDuration = calcRenderDuration(
            [...state.tracks.values()],
            state.tempos,
            state.tpqn,
          );

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
          const globalChannelStrip = new ChannelStrip(offlineAudioContext);
          const limiter = withLimiter
            ? new Limiter(offlineAudioContext)
            : undefined;
          const clipper = new Clipper(offlineAudioContext);
          const tracksShouldPlay = shouldPlay(state.tracks);

          for (const [trackId, track] of state.tracks) {
            const channelStrip = new ChannelStrip(offlineAudioContext);
            channelStrip.volume = track.volume;
            channelStrip.pan = track.pan;
            channelStrip.mute = !tracksShouldPlay[trackId];
            channelStrip.output.connect(globalChannelStrip.input);

            const phrases = state.phrases.get(trackId);
            if (!phrases) {
              throw new Error("Phrases is not found.");
            }

            for (const phrase of phrases.values()) {
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
          }
          globalChannelStrip.volume = 1;
          if (limiter) {
            globalChannelStrip.output.connect(limiter.input);
            limiter.output.connect(clipper.input);
          } else {
            globalChannelStrip.output.connect(clipper.input);
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
        try {
          const result = await exportWaveFile();
          dispatch("SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON", {
            message: `音声を書き出しました`,
            tipName: "notifyOnGenerate",
          });

          return result;
        } finally {
          commit("SET_CANCELLATION_OF_AUDIO_EXPORT_REQUESTED", {
            cancellationOfAudioExportRequested: false,
          });
          commit("SET_NOW_AUDIO_EXPORTING", { nowAudioExporting: false });
        }
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

  SET_TRACKS: {
    mutation(state, { tracks }) {
      state.tracks = tracks;
      state.overlappingNoteInfos = new Map(
        [...tracks.keys()].map((trackId) => [trackId, new Map()]),
      );
      state.trackOrder = [...tracks.keys()];
      state.selectedTrackId = state.trackOrder[0];
    },
    action({ commit }, { tracks }) {
      commit("SET_TRACKS", { tracks });
    },
  },

  CREATE_TRACK: {
    mutation(state, payload) {
      const track: Track = {
        ...createDefaultTrack(),
        ...payload,
      };
      const currentTrackIndex = state.trackOrder.indexOf(state.selectedTrackId);

      state.tracks.set(payload.trackId, track);
      state.overlappingNoteInfos.set(payload.trackId, new Map());
      state.trackOrder.splice(currentTrackIndex + 1, 0, payload.trackId);
    },
    action({ commit }, payload) {
      commit("CREATE_TRACK", payload);
    },
  },

  SET_TRACK_NAME: {
    mutation(state, { trackId, name }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("Track is not found.");
      }

      track.name = name;
    },
    action({ commit }, { trackId, name }) {
      commit("SET_TRACK_NAME", { trackId, name });
    },
  },

  SET_TRACK_PAN: {
    mutation(state, { trackId, pan }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("Track is not found.");
      }

      track.pan = pan;
      channelStrips.get(trackId).pan = pan;
    },
    action({ commit }, { trackId, pan }) {
      commit("SET_TRACK_PAN", { trackId, pan });
    },
  },

  SET_TRACK_VOLUME: {
    mutation(state, { trackId, volume }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("Track is not found.");
      }

      track.volume = volume;
      channelStrips.get(trackId).volume = volume;
    },
    action({ commit }, { trackId, volume }) {
      commit("SET_TRACK_VOLUME", { trackId, volume });
    },
  },

  SET_TRACK_MUTE: {
    mutation(state, { trackId, mute }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("Track is not found.");
      }

      track.mute = mute;
      updateTrackMute(shouldPlay(state.tracks));
    },
    action({ commit }, { trackId, mute }) {
      commit("SET_TRACK_MUTE", { trackId, mute });
    },
  },

  SET_TRACK_SOLO: {
    mutation(state, { trackId, solo }) {
      const track = state.tracks.get(trackId);
      if (track == undefined) {
        throw new Error("Track is not found.");
      }

      track.solo = solo;
      updateTrackMute(shouldPlay(state.tracks));
    },
    action({ commit }, { trackId, solo }) {
      commit("SET_TRACK_SOLO", { trackId, solo });
    },
  },

  UNSOLO_ALL_TRACKS: {
    mutation(draft) {
      for (const trackId of draft.trackOrder) {
        singingStore.mutations.SET_TRACK_SOLO(draft, {
          trackId: trackId,
          solo: false,
        });
      }
    },
    action({ commit }) {
      commit("UNSOLO_ALL_TRACKS");
    },
  },

  DELETE_TRACK: {
    mutation(state, { trackId }) {
      if (state.selectedTrackId === trackId) {
        const currentTrackIndex = state.trackOrder.indexOf(trackId);

        const nextTrackId =
          currentTrackIndex === 0
            ? state.trackOrder[currentTrackIndex + 1]
            : state.trackOrder[currentTrackIndex - 1];
        state.selectedTrackId = nextTrackId;
      }
      state.trackOrder = state.trackOrder.filter((id) => id !== trackId);
      state.tracks.delete(trackId);

      state.phrases.delete(trackId);

      state.overlappingNoteInfos.delete(trackId);
      channelStrips.delete(trackId);
    },
  },

  REORDER_TRACKS: {
    mutation(state, { trackIds }) {
      state.trackOrder = trackIds;
    },
    action({ commit }, { trackIds }) {
      commit("REORDER_TRACKS", { trackIds });
    },
  },
});

export const singingCommandStoreState: SingingCommandStoreState = {};

export const singingCommandStore = transformCommandStore(
  createPartialStore<SingingCommandStoreTypes>({
    COMMAND_SET_SINGER: {
      mutation(draft, { trackId, singer, withRelated }) {
        singingStore.mutations.SET_SINGER(draft, {
          trackId,
          singer,
          withRelated,
        });
      },
      async action({ dispatch, commit }, { trackId, singer, withRelated }) {
        dispatch("SETUP_SINGER", { singer });
        commit("COMMAND_SET_SINGER", { trackId, singer, withRelated });

        dispatch("RENDER");
      },
    },
    COMMAND_SET_KEY_RANGE_ADJUSTMENT: {
      mutation(draft, { keyRangeAdjustment, trackId }) {
        singingStore.mutations.SET_KEY_RANGE_ADJUSTMENT(draft, {
          keyRangeAdjustment,
          trackId,
        });
      },
      async action({ dispatch, commit }, { keyRangeAdjustment, trackId }) {
        if (!isValidKeyRangeAdjustment(keyRangeAdjustment)) {
          throw new Error("The keyRangeAdjustment is invalid.");
        }
        commit("COMMAND_SET_KEY_RANGE_ADJUSTMENT", {
          trackId,
          keyRangeAdjustment,
        });

        dispatch("RENDER");
      },
    },
    COMMAND_SET_VOLUME_RANGE_ADJUSTMENT: {
      mutation(draft, { trackId, volumeRangeAdjustment }) {
        singingStore.mutations.SET_VOLUME_RANGE_ADJUSTMENT(draft, {
          volumeRangeAdjustment,
          trackId,
        });
      },
      async action({ dispatch, commit }, { volumeRangeAdjustment, trackId }) {
        if (!isValidVolumeRangeAdjustment(volumeRangeAdjustment)) {
          throw new Error("The volumeRangeAdjustment is invalid.");
        }
        commit("COMMAND_SET_VOLUME_RANGE_ADJUSTMENT", {
          volumeRangeAdjustment,
          trackId,
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

    COMMAND_CREATE_TRACK: {
      mutation(draft, { singer }) {
        const trackId = TrackId(uuidv4());
        singingStore.mutations.CREATE_TRACK(draft, { singer, trackId });
        draft.selectedTrackId = trackId;
      },
      action({ commit }, { singer }) {
        commit("COMMAND_CREATE_TRACK", { singer });
      },
    },

    COMMAND_DELETE_TRACK: {
      mutation(draft, { trackId }) {
        singingStore.mutations.DELETE_TRACK(draft, { trackId });
      },
      action({ commit }, { trackId }) {
        commit("COMMAND_DELETE_TRACK", { trackId });
      },
    },

    COMMAND_REORDER_TRACKS: {
      mutation(draft, { trackIds }) {
        singingStore.mutations.REORDER_TRACKS(draft, { trackIds });
      },
      action({ commit }, { trackIds }) {
        commit("COMMAND_REORDER_TRACKS", { trackIds });
      },
    },

    COMMAND_SET_TRACK_NAME: {
      mutation(draft, { trackId, name }) {
        singingStore.mutations.SET_TRACK_NAME(draft, { trackId, name });
      },
      action({ commit }, { trackId, name }) {
        commit("COMMAND_SET_TRACK_NAME", { trackId, name });
      },
    },

    COMMAND_SET_TRACK_PAN: {
      mutation(state, { trackId, pan }) {
        singingStore.mutations.SET_TRACK_PAN(state, { trackId, pan });
      },
      action({ commit }, { trackId, pan }) {
        commit("COMMAND_SET_TRACK_PAN", { trackId, pan });
      },
    },

    COMMAND_SET_TRACK_VOLUME: {
      mutation(state, { trackId, volume }) {
        singingStore.mutations.SET_TRACK_VOLUME(state, { trackId, volume });
      },
      action({ commit }, { trackId, volume }) {
        commit("COMMAND_SET_TRACK_VOLUME", { trackId, volume });
      },
    },

    COMMAND_SET_TRACK_MUTE: {
      mutation(draft, { trackId, mute }) {
        singingStore.mutations.SET_TRACK_MUTE(draft, { trackId, mute });
      },
      action({ commit }, { trackId, mute }) {
        commit("COMMAND_SET_TRACK_MUTE", { trackId, mute });
      },
    },

    COMMAND_SET_TRACK_SOLO: {
      mutation(draft, { trackId, solo }) {
        singingStore.mutations.SET_TRACK_SOLO(draft, { trackId, solo });
      },
      action({ commit }, { trackId, solo }) {
        commit("COMMAND_SET_TRACK_SOLO", { trackId, solo });
      },
    },

    COMMAND_UNSOLO_ALL_TRACKS: {
      mutation(draft) {
        singingStore.mutations.UNSOLO_ALL_TRACKS(draft, undefined);
      },
      action({ commit }) {
        commit("COMMAND_UNSOLO_ALL_TRACKS");
      },
    },

    COMMAND_SET_PITCH_EDIT_DATA: {
      mutation(draft, { data, startFrame, trackId }) {
        singingStore.mutations.SET_PITCH_EDIT_DATA(draft, {
          data,
          startFrame,
          trackId,
        });
      },
      action({ commit, dispatch }, { data, startFrame, trackId }) {
        if (startFrame < 0) {
          throw new Error("startFrame must be greater than or equal to 0.");
        }
        if (!isValidPitchEditData(data)) {
          throw new Error("The pitch edit data is invalid.");
        }
        commit("COMMAND_SET_PITCH_EDIT_DATA", { data, startFrame, trackId });

        dispatch("RENDER");
      },
    },
    COMMAND_ERASE_PITCH_EDIT_DATA: {
      mutation(draft, { startFrame, frameLength, trackId }) {
        singingStore.mutations.ERASE_PITCH_EDIT_DATA(draft, {
          startFrame,
          frameLength,
          trackId,
        });
      },
      action({ commit, dispatch }, { startFrame, frameLength, trackId }) {
        if (startFrame < 0) {
          throw new Error("startFrame must be greater than or equal to 0.");
        }
        if (frameLength < 1) {
          throw new Error("frameLength must be at least 1.");
        }
        commit("COMMAND_ERASE_PITCH_EDIT_DATA", {
          startFrame,
          frameLength,
          trackId,
        });

        dispatch("RENDER");
      },
    },
  }),
  "song",
);
