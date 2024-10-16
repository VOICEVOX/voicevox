<template>
  <QDialog v-model="modelValue">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">ルーティング</div>
      </QCardSection>

      <QSeparator />

      <QCardSection>
        <p class="text-body2 text-grey-8">
          ルーティング情報はプロジェクトファイルではなくプラグイン側に保存されます。
        </p>
        <div
          v-if="props.routingInfo.status === 'loading'"
          class="spinner-container"
        >
          <QSpinner />
        </div>

        <template v-else>
          <BaseCell
            title="チャンネルモード"
            description="トラック毎に1ch割り当てるか、2ch割り当てるか選べます。"
          >
            <QBtnToggle
              v-model="channelMode"
              :options="channelModes"
              padding="xs md"
              unelevated
              color="surface"
              textColor="display"
              toggleColor="primary"
              toggleTextColor="display-on-primary"
              dense
            />
          </BaseCell>
          <QList bordered class="rounded-borders scroll scrollable-area">
            <QItem v-for="trackId in trackIds" :key="trackId" tag="label">
              <QItemSection>
                <QItemLabel>
                  {{ props.tracks[trackId].name }}
                </QItemLabel>
              </QItemSection>
              <QItemSection>
                <QSelect
                  :modelValue="props.routingInfo.data.channelIndex[trackId]"
                  :options="channelOptions"
                  emitValue
                  mapOptions
                  dense
                  optionsDense
                  @update:modelValue="updateRoutingInfo(trackId, $event)"
                />
              </QItemSection>
            </QItem>
          </QList>
        </template>
      </QCardSection>

      <QSeparator />

      <QCardActions>
        <QSpace />
        <QBtn
          padding="xs md"
          label="閉じる"
          unelevated
          color="surface"
          textColor="display"
          class="q-mt-sm"
          @click="modelValue = false"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseCell from "../ExportSongAudioDialog/BaseCell.vue";
import { Routing } from "@/backend/vst/type";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { Track } from "@/store/type";
import { TrackId } from "@/type/preload";

export type RoutingState =
  | { status: "loading" }
  | {
      status: "loaded";
      data: Routing;
    };

const modelValue = defineModel<boolean>({ default: false });
const props = defineProps<{
  routingInfo: RoutingState;
  tracks: Record<TrackId, Track>;
  trackOrder: TrackId[];
}>();
const emit = defineEmits<{
  updateRoutingInfo: [routing: Routing];
}>();

const trackIds = computed(() =>
  props.trackOrder.filter((id) => id in props.tracks),
);
const channelMode = computed({
  get: () =>
    props.routingInfo.status === "loading"
      ? ""
      : props.routingInfo.data.channelMode,
  set: (value: string) => {
    if (props.routingInfo.status === "loading") return;
    const newRouting = cloneWithUnwrapProxy(props.routingInfo.data);
    newRouting.channelMode = value as "stereo" | "mono";
    const maxChannels = value === "stereo" ? 64 / 2 : 64;
    for (const [i, trackId] of trackIds.value.entries()) {
      newRouting.channelIndex[trackId] = i % maxChannels;
    }

    emit("updateRoutingInfo", newRouting);
  },
});
const channelModes = [
  { label: "ステレオ", value: "stereo" },
  { label: "モノラル", value: "mono" },
];

const numChannels = 64;

const channelOptions = computed(() => {
  if (channelMode.value === "stereo") {
    return Array.from({ length: numChannels / 2 }).map((_, i) => ({
      label: `${i * 2 + 1} - ${i * 2 + 2}`,
      value: i,
    }));
  } else {
    return Array.from({ length: numChannels }).map((_, i) => ({
      label: String(i + 1),
      value: i,
    }));
  }
});

const updateRoutingInfo = (trackId: TrackId, index: number) => {
  if (props.routingInfo.status === "loading") return;
  const newRouting = cloneWithUnwrapProxy(props.routingInfo.data);
  newRouting.channelIndex[trackId] = index;

  emit("updateRoutingInfo", newRouting);
};
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.dialog-card {
  width: 700px;
  max-width: 80vw;
}

.spinner-container {
  display: grid;
  place-items: center;
}

.scrollable-area {
  overflow-y: auto;
  max-height: calc(100vh - 100px - 295px);
}
</style>
