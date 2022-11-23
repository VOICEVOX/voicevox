<template>
  <div class="sing-toolbar">
    <div
      class="singer-panel-toggler"
      v-bind:class="{ active: isShowSinger }"
      @click="toggleShowSinger"
    >
      <img :src="selectedStyleIconPath" class="singer-avatar" />
    </div>
    <div class="sing-player">
      <button type="button" class="sing-button-temp">戻る</button>
      <button type="button" class="sing-button-temp">再生</button>
      <div class="sing-player-position">00:00</div>
      <q-input
        type="number"
        :model-value="tempoInputBuffer"
        dense
        hide-bottom-space
        class="sing-tempo"
        @update:model-value="setTempoInputBuffer"
        @change="setTempo()"
      >
        <template v-slot:prepend>
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
        @change="setTimeSignature()"
      >
        <template v-slot:prepend>
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
        @change="setTimeSignature()"
      >
        <template v-slot:prepend>
          <div />
        </template>
      </q-input>
    </div>
    <div class="sing-setting">
      <input type="range" min="0" max="100" class="sing-volume" />
      <select class="sing-snap">
        <option>1/16</option>
      </select>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, watch, ref } from "vue";
import { useStore } from "@/store";

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

    const setTempoInputBuffer = (tempoStr: string) => {
      const tempo = Number(tempoStr);
      if (Number.isNaN(tempo) || tempo <= 0) return;
      tempoInputBuffer.value = tempo;
    };
    const setBeatsInputBuffer = (beatsStr: string) => {
      const beats = Number(beatsStr);
      if (!Number.isInteger(beats) || beats <= 0) return;
      beatsInputBuffer.value = beats;
    };
    const setBeatTypeInputBuffer = (beatTypeStr: string) => {
      const beatType = Number(beatTypeStr);
      if (!Number.isInteger(beatType) || beatType <= 0) return;
      beatTypeInputBuffer.value = beatType;
    };

    const tempos = computed(() => store.state.score?.tempos);
    const timeSignatures = computed(() => store.state.score?.timeSignatures);

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
      },
      { deep: true }
    );
    watch(
      timeSignatures,
      () => {
        beatTypeInputBuffer.value = timeSignatures.value?.[0].beatType ?? 0;
      },
      { deep: true }
    );

    const setTempo = async () => {
      const tempo = tempoInputBuffer.value;
      if (tempo === 0) return;
      await store.dispatch("ADD_TEMPO", {
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
      await store.dispatch("ADD_TIME_SIGNATURE", {
        timeSignature: {
          position: 0,
          beats: beats,
          beatType: beatType,
        },
      });
    };

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

.sing-button-temp {
  margin: 0 4px;
}

.sing-tempo {
  margin: 0 4px;
  width: 64px;
}

.sing-time-signature {
  margin: 0 4px;
  width: 36px;
}

.sing-player-position {
  font-size: 18px;
  margin: 0 4px;
}

.sing-setting {
  align-items: center;
  display: flex;
  margin-left: auto;
}

.sing-volume {
  margin-right: 4px;
  width: 72px;
}
</style>
