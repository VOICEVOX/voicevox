<template>
  <div class="sing-toolbar">
    <div
      class="singer-panel-toggler"
      :class="{ active: isShowSinger }"
      @click="toggleShowSinger"
    >
      <img :src="selectedStyleIconPath" class="singer-avatar" />
    </div>
    <div class="sing-player">
      <q-btn
        flat
        round
        class="sing-transport-button"
        icon="skip_previous"
        @click="seek(0)"
      ></q-btn>
      <q-btn
        v-if="!nowPlaying"
        round
        class="sing-playback-button"
        icon="play_arrow"
        @click="play"
      ></q-btn>
      <q-btn
        v-else
        round
        class="sing-playback-button"
        icon="stop"
        @click="stop"
      ></q-btn>
      <q-btn flat round class="sing-transport-button" icon="loop"></q-btn>
      <div class="sing-playback-position">{{ playbackPositionStr }}</div>
      <q-input
        type="number"
        :model-value="tempoInputBuffer"
        dense
        hide-bottom-space
        class="sing-tempo"
        @update:model-value="setTempoInputBuffer"
        @change="setTempo"
      >
        <template #prepend>
          <div />
        </template>
      </q-input>
      <q-input
        type="number"
        :model-value="beatsInputBuffer"
        dense
        hide-bottom-space
        class="sing-time-signature"
        @update:model-value="setBeatsInputBuffer"
        @change="setTimeSignature"
      >
        <template #prepend>
          <div />
        </template>
      </q-input>
      /
      <q-input
        type="number"
        :model-value="beatTypeInputBuffer"
        dense
        hide-bottom-space
        class="sing-time-signature"
        @update:model-value="setBeatTypeInputBuffer"
        @change="setTimeSignature"
      >
        <template #prepend>
          <div />
        </template>
      </q-input>
    </div>
    <div class="sing-setting">
      <q-slider v-model.number="volume" class="sing-volume" />
      <q-select
        v-model="snapTypeSelectModel"
        :options="snapTypeSelectOptions"
        color="primary"
        text-color="display-on-primary"
        outlined
        dense
        options-dense
        transition-show="none"
        transition-hide="none"
        class="sing-snap"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, watch, ref } from "vue";
import { useStore } from "@/store";
import { getSnapTypes, isTriplet } from "@/helpers/singHelper";

export default defineComponent({
  name: "SingToolBar",

  setup() {
    const store = useStore();
    const isShowSinger = computed(() => store.state.isShowSinger);
    const toggleShowSinger = () => {
      store.dispatch("SET_SHOW_SINGER", {
        isShowSinger: !isShowSinger.value,
      });
    };

    const userOrderedCharacterInfos = computed(
      () => store.getters.USER_ORDERED_CHARACTER_INFOS
    );
    const selectedCharacterInfo = computed(() =>
      userOrderedCharacterInfos.value !== undefined &&
      store.state.engineId !== undefined &&
      store.state.styleId !== undefined
        ? store.getters.CHARACTER_INFO(
            store.state.engineId,
            store.state.styleId
          )
        : undefined
    );
    const selectedStyleIconPath = computed(
      () =>
        selectedCharacterInfo.value?.metas.styles.find(
          (style) =>
            style.styleId === store.state.styleId &&
            style.engineId === store.state.engineId
        )?.iconPath
    );

    const tempoInputBuffer = ref(0);
    const beatsInputBuffer = ref(0);
    const beatTypeInputBuffer = ref(0);

    const setTempoInputBuffer = (tempoStr: string | number | null) => {
      const tempo = Number(tempoStr);
      if (!Number.isFinite(tempo) || tempo <= 0) return;
      tempoInputBuffer.value = tempo;
    };
    const setBeatsInputBuffer = (beatsStr: string | number | null) => {
      const beats = Number(beatsStr);
      if (!Number.isInteger(beats) || beats <= 0) return;
      beatsInputBuffer.value = beats;
    };
    const setBeatTypeInputBuffer = (beatTypeStr: string | number | null) => {
      const beatType = Number(beatTypeStr);
      if (!Number.isInteger(beatType) || beatType <= 0) return;
      beatTypeInputBuffer.value = beatType;
    };

    const playPos = ref(0);

    const playbackPositionStr = computed(() => {
      let playTime = 0;
      if (store.state.score) {
        playTime = store.getters.POSITION_TO_TIME(playPos.value);
      }

      const intPlayTime = Math.floor(playTime);
      const min = Math.floor(intPlayTime / 60);
      const minStr = String(min).padStart(2, "0");
      const secStr = String(intPlayTime - min * 60).padStart(2, "0");
      const match = String(playTime).match(/\.(\d+)$/);
      const milliSecStr = (match?.[1] ?? "0").padEnd(3, "0").substring(0, 3);

      return `${minStr}:${secStr}.${milliSecStr}`;
    });

    const tempos = computed(() => store.state.score?.tempos);
    const timeSignatures = computed(() => store.state.score?.timeSignatures);
    const nowPlaying = computed(() => store.state.nowPlaying);

    watch(
      tempos,
      () => {
        tempoInputBuffer.value = tempos.value?.[0].tempo ?? 0;
      },
      { deep: true }
    );
    watch(
      timeSignatures,
      () => {
        beatsInputBuffer.value = timeSignatures.value?.[0].beats ?? 0;
        beatTypeInputBuffer.value = timeSignatures.value?.[0].beatType ?? 0;
      },
      { deep: true }
    );

    const timeout = 1 / 60;
    let timeoutId: number | undefined = undefined;
    watch(nowPlaying, (newState) => {
      if (newState) {
        const updateView = () => {
          playPos.value = store.getters.GET_PLAYBACK_POSITION();
          timeoutId = window.setTimeout(updateView, timeout);
        };
        updateView();
      } else if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    });

    const setTempo = async () => {
      const tempo = tempoInputBuffer.value;
      if (tempo === 0) return;
      await store.dispatch("SET_TEMPO", {
        tempo: {
          position: 0,
          tempo: tempo,
        },
      });
    };

    const setTimeSignature = async () => {
      const beats = beatsInputBuffer.value;
      const beatType = beatTypeInputBuffer.value;
      if (beats === 0 || beatType === 0) return;
      await store.dispatch("SET_TIME_SIGNATURE", {
        timeSignature: {
          position: 0,
          beats: beats,
          beatType: beatType,
        },
      });
    };

    const play = () => {
      store.dispatch("SING_PLAY_AUDIO");
    };

    const stop = () => {
      store.dispatch("SING_STOP_AUDIO");
    };

    const seek = async (position: number) => {
      await store.dispatch("SET_PLAYBACK_POSITION", { position });
      playPos.value = position;
    };

    const volume = computed({
      get() {
        return store.state.volume * 100;
      },
      set(value: number) {
        store.dispatch("SET_VOLUME", { volume: value / 100 });
      },
    });

    const snapTypeSelectOptions = computed(() => {
      const tpqn = store.state.score?.resolution ?? 480;
      return getSnapTypes(tpqn).map((snapType) => {
        if (isTriplet(snapType)) {
          return { snapType, label: `1/${(snapType / 3) * 2}（三連符）` };
        } else {
          return { snapType, label: `1/${snapType}` };
        }
      });
    });
    const snapTypeSelectModel = computed({
      get() {
        const snapType = store.state.sequencerSnapType;
        const selectOptions = snapTypeSelectOptions.value;
        return (
          selectOptions.find((value) => value.snapType === snapType) ??
          selectOptions[selectOptions.length - 1]
        );
      },
      set(value) {
        store.dispatch("SET_SNAP_TYPE", {
          snapType: value.snapType,
        });
      },
    });

    return {
      isShowSinger,
      toggleShowSinger,
      selectedStyleIconPath,
      tempoInputBuffer,
      beatsInputBuffer,
      beatTypeInputBuffer,
      setTempoInputBuffer,
      setBeatsInputBuffer,
      setBeatTypeInputBuffer,
      setTempo,
      setTimeSignature,
      playbackPositionStr,
      nowPlaying,
      play,
      stop,
      seek,
      volume,
      snapTypeSelectOptions,
      snapTypeSelectModel,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.sing-toolbar {
  border-top: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
  align-items: center;
  display: flex;
  padding: 8px 16px;
  width: 100%;
}
.singer-panel-toggler {
  border: 2px solid #777;
  border-radius: 50%;
  display: block;
  height: 48px;
  margin-right: auto;
  overflow: hidden;
  width: 48px;

  &:hover {
    cursor: pointer;
  }

  &.active {
    border-color: colors.$primary;
  }
}

.singer-avatar {
  background: colors.$background;
  display: block;
  object-fit: cover;
  height: 100%;
  width: 100%;
}

.sing-player {
  align-items: center;
  display: flex;
}

.sing-transport-button {
  margin: 0 1px;
}

.sing-playback-button {
  margin: 0 4px;
}

.sing-tempo {
  margin-left: 16px;
  margin-right: 4px;
  width: 64px;
}

.sing-time-signature {
  margin: 0 4px;
  width: 36px;
}

.sing-playback-position {
  font-size: 18px;
  margin: 0 4px;
  min-width: 82px;
}

.sing-setting {
  align-items: center;
  display: flex;
  margin-left: auto;
}

.sing-volume {
  margin-right: 16px;
  width: 72px;
}

.sing-snap {
  margin-right: 2px;
  min-width: 160px;
}
</style>
