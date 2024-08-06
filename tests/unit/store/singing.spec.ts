import { store } from "@/store";
import { TrackId } from "@/type/preload";
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
