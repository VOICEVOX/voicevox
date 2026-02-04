import { beforeEach, expect, test } from "vitest";
import { store } from "@/store";
import { NoteId, TrackId } from "@/type/preload";
import { resetMockMode, uuid4 } from "@/helpers/random";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { createDefaultTrack } from "@/sing/domain";

const initialState = cloneWithUnwrapProxy(store.state);
beforeEach(() => {
  store.replaceState(initialState);

  resetMockMode();
});

test("INSERT_TRACK", () => {
  const dummyTrack = createDefaultTrack();

  // 最後尾に追加
  // NOTE: 最初から１つトラックが登録されている
  const trackId1 = TrackId(uuid4());
  store.mutations.INSERT_TRACK({
    trackId: trackId1,
    track: dummyTrack,
    prevTrackId: undefined,
  });
  expect(store.state.trackOrder.slice(1)).toEqual([trackId1]);

  // 途中に追加
  const trackId2 = TrackId(uuid4());
  store.mutations.INSERT_TRACK({
    trackId: trackId2,
    track: dummyTrack,
    prevTrackId: store.state.trackOrder[0],
  });
  expect(store.state.trackOrder.slice(1)).toEqual([trackId2, trackId1]);
});

test("COMMAND_DUPLICATE_TRACK", async () => {
  const sourceTrackId = store.state.trackOrder[0];
  const sourceTrack = store.state.tracks.get(sourceTrackId);
  if (!sourceTrack) {
    throw new Error("sourceTrack not found");
  }

  // 直接代入ではなくミューテーション経由でセットアップ
  store.mutations.SET_TRACK_NAME({
    trackId: sourceTrackId,
    name: "Original Track",
  });
  store.mutations.COMMAND_SET_TRACK_MUTE({
    trackId: sourceTrackId,
    mute: true,
  });
  store.mutations.COMMAND_SET_TRACK_SOLO({
    trackId: sourceTrackId,
    solo: true,
  });
  const notes = [
    {
      id: NoteId(uuid4()),
      position: 0,
      duration: 480,
      noteNumber: 60,
      lyric: "test",
    },
  ];
  store.mutations.SET_NOTES({ trackId: sourceTrackId, notes });

  // ピッチ・音量編集データ
  const sourceTrackClone = cloneWithUnwrapProxy(sourceTrack);
  sourceTrackClone.pitchEditData = [440, 442, 440];
  sourceTrackClone.volumeEditData = [1.0, 1.2, 1.0];
  // 音素タイミング編集データ
  const noteId = notes[0].id;
  sourceTrackClone.phonemeTimingEditData.set(noteId, [
    { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
  ]);
  store.mutations.SET_TRACK({
    trackId: sourceTrackId,
    track: sourceTrackClone,
  });
  const initialTrackIds = new Set(store.state.trackOrder);
  const sourceTrackIndex = store.state.trackOrder.indexOf(sourceTrackId);
  await store.actions.COMMAND_DUPLICATE_TRACK({ trackId: sourceTrackId });

  expect(store.state.trackOrder.length).toBe(initialTrackIds.size + 1);
  const newTrackId = store.state.trackOrder[sourceTrackIndex + 1];
  expect(initialTrackIds.has(newTrackId)).toBe(false);
  const newTrack = store.state.tracks.get(newTrackId);
  if (!newTrack) {
    throw new Error("newTrack not found");
  }

  expect(newTrack.name).toBe("Original Track - コピー");
  expect(newTrack.mute).toBe(true);
  expect(newTrack.solo).toBe(true);
  expect(newTrack.notes.length).toBe(1);
  expect(newTrack.notes[0].id).not.toBe(noteId);
  expect(newTrack.notes[0].lyric).toBe("test");
  expect(newTrack.pitchEditData).toEqual([440, 442, 440]);
  expect(newTrack.volumeEditData).toEqual([1.0, 1.2, 1.0]);

  // 音素タイミング編集データが新しいノートIDで引き継がれているか
  const newNoteId = newTrack.notes[0].id;
  expect(newTrack.phonemeTimingEditData.has(newNoteId)).toBe(true);
  expect(newTrack.phonemeTimingEditData.get(newNoteId)).toEqual([
    { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
  ]);

  // 新しいトラックが選択されているか
  expect(store.getters.SELECTED_TRACK_ID).toBe(newTrackId);
});

test("RENDER is no-op when AudioContext is undefined", async () => {
  // テスト環境では通常 AudioContext が undefined なので、呼び出してエラーが発生しないことを確認
  await store.actions.RENDER();
  expect(store.state.nowRendering).toBe(false);
});

test("SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS is no-op when AudioContext is undefined", async () => {
  // AudioContext が無い環境でも呼び出して例外が出ないことを確認
  await expect(store.actions.SYNC_TRACKS_AND_TRACK_CHANNEL_STRIPS()).resolves.toBeUndefined();
});
