<template>
  <div class="track-item-container">
    <QItem
      v-ripple
      clickable
      class="track-item"
      activeClass="selected-track"
      :active="props.trackId === selectedTrackId"
      :disable="uiLocked"
      @click="selectTrack()"
    >
      <ContextMenu
        :menudata="[
          {
            type: 'button',
            label: 'トラック追加',
            onClick: addTrack,
            disableWhenUiLocked: true,
          },
          {
            type: 'button',
            label: 'トラック削除',
            onClick: deleteTrack,
            disabled: tracks.size === 1,
            disableWhenUiLocked: true,
          },
        ]"
      />
      <!-- 左端のドラッグ判定 -->
      <div :class="props.draggableClass" class="track-handle-bg" />
      <!-- 選択中のトラックの左端に表示される矢印 -->
      <QIcon
        v-if="props.trackId === selectedTrackId"
        name="arrow_right"
        color="primary"
        size="md"
        class="active-arrow"
      />
      <!-- アイコン -->
      <QItemSection
        avatar
        class="singer-icon-container"
        :class="props.draggableClass"
        @click.stop=""
      >
        <div class="singer-icon-hitbox">
          <SingerIcon
            v-if="trackCharacter"
            round
            class="singer-icon"
            size="3rem"
            :style="trackCharacter.style"
          />
          <QAvatar v-else round size="3rem" color="primary"
            ><span color="text-display-on-primary">?</span></QAvatar
          >
          <CharacterSelectMenu :trackId="props.trackId" />
        </div>
      </QItemSection>
      <!-- トラック名、キャラ名表示 -->
      <QItemSection>
        <QItemLabel class="track-name" @click.stop="uiLocked || selectTrack()">
          <QInput
            v-if="props.trackId === selectedTrackId"
            v-model="temporaryTrackName"
            dense
            :disable="uiLocked"
            @blur="updateTrackName"
          />
          <div v-else class="walkaround-unselected-track-name">
            {{ track.name }}
          </div>
        </QItemLabel>
        <QItemLabel v-if="trackCharacter" caption class="singer-name">
          <!-- ミュート中はアイコンを表示 -->
          <QIcon
            v-if="!shouldPlayTrack"
            name="volume_off"
            color="display"
            :style="{ opacity: 0.8 }"
          />
          {{ singerName }}
        </QItemLabel>
      </QItemSection>
      <!-- ミュート・ソロボタン -->
      <QItemSection side class="track-control-container">
        <div class="track-control">
          <QBtn
            :color="track.mute ? 'primary' : 'default'"
            :textColor="track.mute ? 'display-on-primary' : 'display'"
            icon="volume_off"
            round
            unelevated
            :outline="!track.mute"
            dense
            size="sm"
            class="track-button"
            :class="{ 'track-button-active': track.mute }"
            :disable="uiLocked || isThereSoloTrack"
            @click.stop="setTrackMute(!track.mute)"
          >
            <QTooltip :delay="500">ミュート</QTooltip>
          </QBtn>
          <QBtn
            :color="track.solo ? 'primary' : 'default'"
            :textColor="track.solo ? 'display-on-primary' : 'display'"
            icon="headset"
            rounded
            unelevated
            :outline="!track.solo"
            dense
            size="sm"
            class="track-button"
            :class="{ 'track-button-active': track.solo }"
            :disable="uiLocked"
            @click.stop="setTrackSolo(!track.solo)"
          >
            <QTooltip :delay="500">ソロ</QTooltip>
          </QBtn>
        </div>
      </QItemSection>
    </QItem>

    <!-- トラックのパン・ボリューム調整 -->
    <QItem
      v-if="props.trackId === selectedTrackId"
      class="track-detail-container"
    >
      <div class="track-detail">
        <div class="pan">
          <div class="l">L</div>
          <QSlider
            :modelValue="track.pan"
            :min="-1"
            :max="1"
            :step="0.01"
            :markers="1"
            selectionColor="transparent"
            :disable="uiLocked"
            @change="setTrackPan($event)"
            @dblclick="setTrackPan(0)"
          />
          <div class="r">R</div>
        </div>
        <div class="gain">
          <QIcon name="volume_down" class="l" size="1rem" />
          <QSlider
            :modelValue="track.gain"
            :min="0"
            :max="1"
            :step="0.01"
            :markers="1"
            :disable="uiLocked"
            @change="setTrackGain($event)"
            @dblclick="setTrackGain(1)"
          />
          <QIcon name="volume_up" class="r" size="1rem" />
        </div>
      </div>
    </QItem>
  </div>
</template>
<script setup lang="ts">
import { computed, watchEffect, ref } from "vue";
import CharacterSelectMenu from "@/components/Sing/CharacterMenuButton/CharacterSelectMenu.vue";
import SingerIcon from "@/components/Sing/SingerIcon.vue";
import { useStore } from "@/store";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import { shouldPlayTracks } from "@/sing/domain";
import { CharacterInfo, StyleInfo, TrackId } from "@/type/preload";

const props = defineProps<{
  trackId: TrackId;

  draggableClass: string;
}>();

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);
const track = computed(() => {
  const track = store.state.tracks.get(props.trackId);
  if (!track) throw new Error(`Track not found: ${props.trackId}`);
  return track;
});

const tracks = computed(() => store.state.tracks);
const trackOrder = computed(() => store.state.trackOrder);
const isThereSoloTrack = computed(() =>
  [...tracks.value.values()].some((track) => track.solo),
);
const shouldPlayTrack = computed(() =>
  shouldPlayTracks(store.state.tracks).has(props.trackId),
);

const setTrackPan = (pan: number) => {
  if (store.state.undoableTrackOperations.panAndGain) {
    void store.actions.COMMAND_SET_TRACK_PAN({
      trackId: props.trackId,
      pan,
    });
  } else {
    void store.actions.SET_TRACK_PAN({ trackId: props.trackId, pan });
  }
};

const setTrackGain = (gain: number) => {
  if (store.state.undoableTrackOperations.panAndGain) {
    void store.actions.COMMAND_SET_TRACK_GAIN({
      trackId: props.trackId,
      gain,
    });
  } else {
    void store.actions.SET_TRACK_GAIN({ trackId: props.trackId, gain });
  }
};

const temporaryTrackName = ref(track.value.name);
watchEffect(() => {
  temporaryTrackName.value = track.value.name;
});

const updateTrackName = () => {
  if (temporaryTrackName.value === track.value.name) return;

  // 空のトラック名だと空欄のようになってしまうので許容しない
  if (temporaryTrackName.value === "") {
    temporaryTrackName.value = track.value.name;
    return;
  }

  void store.actions.COMMAND_SET_TRACK_NAME({
    trackId: props.trackId,
    name: temporaryTrackName.value,
  });
};

const setTrackMute = (mute: boolean) => {
  if (store.state.undoableTrackOperations.soloAndMute) {
    void store.actions.COMMAND_SET_TRACK_MUTE({
      trackId: props.trackId,
      mute,
    });
  } else {
    void store.actions.SET_TRACK_MUTE({ trackId: props.trackId, mute });
  }
};

const setTrackSolo = (solo: boolean) => {
  if (store.state.undoableTrackOperations.soloAndMute) {
    void store.actions.COMMAND_SET_TRACK_SOLO({
      trackId: props.trackId,
      solo,
    });
  } else {
    void store.actions.SET_TRACK_SOLO({ trackId: props.trackId, solo });
  }
};

const selectedTrackId = computed(() => store.getters.SELECTED_TRACK_ID);

const trackCharacter = computed<
  { character: CharacterInfo; style: StyleInfo } | undefined
>(() => {
  if (!track.value.singer) return undefined;

  for (const character of store.state.characterInfos[
    track.value.singer.engineId
  ]) {
    for (const style of character.metas.styles) {
      if (style.styleId === track.value.singer.styleId) {
        return { character, style };
      }
    }
  }
  return undefined;
});
const selectTrack = () => {
  void store.actions.SET_SELECTED_TRACK({ trackId: props.trackId });
};

const addTrack = async () => {
  const willNextSelectedTrackIndex =
    trackOrder.value.indexOf(props.trackId) + 1;
  await store.actions.COMMAND_INSERT_EMPTY_TRACK({
    prevTrackId: props.trackId,
  });
  await store.actions.SELECT_TRACK({
    trackId: trackOrder.value[willNextSelectedTrackIndex],
  });
};

const deleteTrack = async () => {
  // このトラックが選択中の場合は別のトラックを選択する
  let willNextSelectedTrackIndex: number | undefined = undefined;
  if (selectedTrackId.value === props.trackId) {
    willNextSelectedTrackIndex =
      trackOrder.value.indexOf(selectedTrackId.value) - 1;
    if (willNextSelectedTrackIndex < 0) {
      willNextSelectedTrackIndex = 0;
    }
  }
  await store.actions.COMMAND_DELETE_TRACK({ trackId: props.trackId });
  if (willNextSelectedTrackIndex != undefined) {
    await store.actions.SELECT_TRACK({
      trackId: trackOrder.value[willNextSelectedTrackIndex],
    });
  }
};

const singerName = computed(() => {
  const character = trackCharacter.value;
  if (!character) return "（不明なキャラクター）";
  return character.character.metas.speakerName;
});
</script>
<style scoped lang="scss">
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.track-detail-container {
  padding: 0;

  border-bottom: 1px solid colors.$sequencer-sub-divider;

  // draggingクラスはSideBarのDraggableにより追加/削除される。
  .dragging & {
    display: none;
  }
}

.track-detail {
  padding: 0 0.5rem 0.25rem 0.5rem;
  width: 100%;
  display: flex;
  flex-direction: column;

  .pan,
  .gain {
    display: grid;
    align-items: center;
    gap: 1rem;
    grid-template-columns: 1.5rem 1fr 1.5rem;

    .l,
    .r {
      justify-self: center;
    }
  }
}

.track-item {
  padding-right: 0.5rem;

  &.selected-track {
    color: colors.$display;
  }

  .track-handle-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 4.5rem; // TrackItemの左端からトラック名の左端まで
    height: 100%;
    cursor: grab;
  }

  .track-control-container {
    padding-left: 0.5rem;

    .track-control {
      display: flex;
      align-items: center;
      gap: 0.25rem;

      .track-button {
        width: 1.75rem;
        height: 1.75rem;
        padding: 0;

        // 線を薄くする
        &:not(.track-button-active)::before {
          border-color: rgba(colors.$display-rgb, 0.5);
        }
      }
    }
  }
}

.active-arrow {
  position: absolute;
  left: -0.5rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.singer-icon-container {
  cursor: grab;
}

.singer-icon-hitbox {
  cursor: pointer;
}

.track-name :deep(.q-field__control) {
  height: 1.5rem;
}

.track-name,
.singer-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// 選択されていないトラックのトラック名の表示をQInputの見た目に合わせる
.walkaround-unselected-track-name {
  margin-bottom: 2px;
  margin-top: 3px;
  letter-spacing: 0.00937em;
}
</style>
