import { beforeEach, describe, expect, test } from "vitest";
import { store } from "@/store";
import { NoteId, TrackId } from "@/type/preload";
import { resetMockMode, uuid4 } from "@/helpers/random";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { createDefaultTrack } from "@/sing/domain";
import { getOrThrow } from "@/helpers/mapHelper";

const initialState = cloneWithUnwrapProxy(store.state);
beforeEach(() => {
  const clonedInitialState = cloneWithUnwrapProxy(initialState);
  store.replaceState(clonedInitialState);

  resetMockMode();
});

describe("COMMAND_UPSERT_PHONEME_TIMING_EDIT", () => {
  test("無効なtrackIdを指定するとエラーになる", () => {
    const invalidTrackId = TrackId(uuid4());
    const noteId = NoteId(uuid4());
    expect(() =>
      store.dispatch("COMMAND_UPSERT_PHONEME_TIMING_EDIT", {
        trackId: invalidTrackId,
        noteId,
        phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
      }),
    ).toThrow("The trackId is invalid.");
  });

  test("editsが存在しないnoteIdへ新規追加できる", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    const edit = { phonemeIndexInNote: 0, offsetSeconds: 0.1 };

    await store.dispatch("COMMAND_UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: edit,
    });

    const track = getOrThrow(store.state.tracks, trackId);
    const actualEdits = getOrThrow(track.phonemeTimingEditData, noteId);
    expect(actualEdits).toEqual([edit]);
  });

  test("既存editsに新しいphonemeIndexInNoteを追加すると昇順にソートされる", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 2, offsetSeconds: 0.2 },
    });

    await store.dispatch("COMMAND_UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.0 },
    });

    const track = getOrThrow(store.state.tracks, trackId);
    const actualEdits = getOrThrow(track.phonemeTimingEditData, noteId);
    expect(actualEdits).toEqual([
      { phonemeIndexInNote: 0, offsetSeconds: 0.0 },
      { phonemeIndexInNote: 2, offsetSeconds: 0.2 },
    ]);
  });

  test("同じphonemeIndexInNoteを指定すると上書き更新できる", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });

    await store.dispatch("COMMAND_UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.9 },
    });

    const track = getOrThrow(store.state.tracks, trackId);
    const actualEdits = getOrThrow(track.phonemeTimingEditData, noteId);
    expect(actualEdits).toEqual([
      { phonemeIndexInNote: 0, offsetSeconds: 0.9 },
    ]);
  });
});

describe("COMMAND_ERASE_PHONEME_TIMING_EDITS", () => {
  test("無効なtrackIdを指定するとエラーになる", () => {
    const invalidTrackId = TrackId(uuid4());
    const noteId = NoteId(uuid4());
    expect(() =>
      store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
        trackId: invalidTrackId,
        targets: [{ noteId, phonemeIndexInNote: 0 }],
      }),
    ).toThrow("The trackId is invalid.");
  });

  test("targetsが空配列のとき何も変化しない", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });
    const before = cloneWithUnwrapProxy(
      getOrThrow(store.state.tracks, trackId).phonemeTimingEditData,
    );

    await store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
      trackId,
      targets: [],
    });

    const track = getOrThrow(store.state.tracks, trackId);
    expect(track.phonemeTimingEditData).toEqual(before);
  });

  test("同じ(noteId, phonemeIndexInNote)ペアが重複するとエラーになる", () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });

    expect(() =>
      store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
        trackId,
        targets: [
          { noteId, phonemeIndexInNote: 0 },
          { noteId, phonemeIndexInNote: 0 },
        ],
      }),
    ).toThrow(
      "The targets contain duplicate noteId and phonemeIndexInNote pairs.",
    );
  });

  test("同じnoteIdで異なるphonemeIndexInNoteは重複にならない", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 1, offsetSeconds: 0.2 },
    });

    await store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
      trackId,
      targets: [
        { noteId, phonemeIndexInNote: 0 },
        { noteId, phonemeIndexInNote: 1 },
      ],
    });

    const track = getOrThrow(store.state.tracks, trackId);
    expect(track.phonemeTimingEditData.has(noteId)).toBe(false);
  });

  test("異なるnoteIdで同じphonemeIndexInNoteは重複にならない", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId1 = NoteId(uuid4());
    const noteId2 = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId: noteId1,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId: noteId2,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.2 },
    });

    await store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
      trackId,
      targets: [
        { noteId: noteId1, phonemeIndexInNote: 0 },
        { noteId: noteId2, phonemeIndexInNote: 0 },
      ],
    });

    const track = getOrThrow(store.state.tracks, trackId);
    expect(track.phonemeTimingEditData.has(noteId1)).toBe(false);
    expect(track.phonemeTimingEditData.has(noteId2)).toBe(false);
  });

  test("既存editsがないnoteIdを指定するとエラーになる", () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());

    expect(() =>
      store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
        trackId,
        targets: [{ noteId, phonemeIndexInNote: 0 }],
      }),
    ).toThrow(
      "The targets contain noteId that has no existing phoneme timing edits.",
    );
  });

  test("存在しないphonemeIndexInNoteを指定するとエラーになる", () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });

    expect(() =>
      store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
        trackId,
        targets: [{ noteId, phonemeIndexInNote: 1 }],
      }),
    ).toThrow(
      "The targets contain phonemeIndexInNote that does not exist in current edits.",
    );
  });

  test("1件削除すると該当editが消え残りは保持される", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 1, offsetSeconds: 0.2 },
    });

    await store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
      trackId,
      targets: [{ noteId, phonemeIndexInNote: 0 }],
    });

    const track = getOrThrow(store.state.tracks, trackId);
    const actualEdits = getOrThrow(track.phonemeTimingEditData, noteId);
    expect(actualEdits).toEqual([
      { phonemeIndexInNote: 1, offsetSeconds: 0.2 },
    ]);
  });

  test("noteId内の全editsを削除するとMapのエントリ自体が消える", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });

    await store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
      trackId,
      targets: [{ noteId, phonemeIndexInNote: 0 }],
    });

    const track = getOrThrow(store.state.tracks, trackId);
    expect(track.phonemeTimingEditData.has(noteId)).toBe(false);
  });

  test("複数ノートにまたがって削除できる", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId1 = NoteId(uuid4());
    const noteId2 = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId: noteId1,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId: noteId2,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.2 },
    });

    await store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
      trackId,
      targets: [
        { noteId: noteId1, phonemeIndexInNote: 0 },
        { noteId: noteId2, phonemeIndexInNote: 0 },
      ],
    });

    const track = getOrThrow(store.state.tracks, trackId);
    expect(track.phonemeTimingEditData.has(noteId1)).toBe(false);
    expect(track.phonemeTimingEditData.has(noteId2)).toBe(false);
  });

  test("同一noteId内の複数phonemeをまとめて削除できる", async () => {
    const trackId = store.state.trackOrder[0];
    const noteId = NoteId(uuid4());
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 0, offsetSeconds: 0.1 },
    });
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 1, offsetSeconds: 0.2 },
    });
    store.commit("UPSERT_PHONEME_TIMING_EDIT", {
      trackId,
      noteId,
      phonemeTimingEdit: { phonemeIndexInNote: 2, offsetSeconds: 0.3 },
    });

    await store.dispatch("COMMAND_ERASE_PHONEME_TIMING_EDITS", {
      trackId,
      targets: [
        { noteId, phonemeIndexInNote: 0 },
        { noteId, phonemeIndexInNote: 2 },
      ],
    });

    const track = getOrThrow(store.state.tracks, trackId);
    const actualEdits = getOrThrow(track.phonemeTimingEditData, noteId);
    expect(actualEdits).toEqual([
      { phonemeIndexInNote: 1, offsetSeconds: 0.2 },
    ]);
  });
});

test("INSERT_TRACK", () => {
  const dummyTrack = createDefaultTrack();

  // 最後尾に追加
  // NOTE: 最初から１つトラックが登録されている
  const trackId1 = TrackId(uuid4());
  store.commit("INSERT_TRACK", {
    trackId: trackId1,
    track: dummyTrack,
    prevTrackId: undefined,
  });
  expect(store.state.trackOrder.slice(1)).toEqual([trackId1]);

  // 途中に追加
  const trackId2 = TrackId(uuid4());
  store.commit("INSERT_TRACK", {
    trackId: trackId2,
    track: dummyTrack,
    prevTrackId: store.state.trackOrder[0],
  });
  expect(store.state.trackOrder.slice(1)).toEqual([trackId2, trackId1]);
});
