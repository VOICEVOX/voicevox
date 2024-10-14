<template>
  <QDialog v-model="modelValue">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">ルーティング</div>
      </QCardSection>

      <QSeparator />

      <QCardSection>
        <p class="text-body2 text-grey-8 q-my-none">
          ルーティング情報はプロジェクトファイルではなくプラグイン側に保存されます。<br />

          Shift キーを押しながらスクロールすると横方向にスクロールできます。
        </p>
      </QCardSection>
      <QCardSection class="scroll scrollable-area">
        <div
          v-if="props.routingInfo.status === 'loading'"
          class="spinner-container"
        >
          <QSpinner />
        </div>
        <div v-else class="table-container">
          <div class="track-name-header">トラック名</div>
          <div v-for="i in 16" :key="i" class="channel-name-header">
            Ch. {{ i }}
          </div>
          <div v-for="i in 32" :key="i" class="channel-lr-header">
            {{ i % 2 === 1 ? "L" : "R" }}
          </div>
          <template
            v-for="trackId of props.trackOrder.filter(
              (id) => id in props.tracks,
            )"
            :key="trackId"
          >
            <template v-for="lr in 2" :key="lr">
              <div v-if="lr === 1" class="track-name-item">
                {{ props.tracks[trackId].name }}
              </div>
              <div class="lr-indicator">
                {{ lr === 1 ? "L" : "R" }}
              </div>
              <div
                v-for="i in 32"
                :key="i"
                class="channel-item"
                :class="{ 'left-channel': i % 2 === 1 }"
              >
                <!-- TODO: QTooltipを使う（使うと横幅が壊れる）-->
                <QCheckbox
                  :modelValue="props.routingInfo.data[trackId][lr - 1][i - 1]"
                  dense
                  @update:modelValue="
                    updateRoutingInfo(trackId, lr - 1, i - 1, $event)
                  "
                />
              </div>
            </template>
          </template>
        </div>
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
import { Routing } from "@/backend/vst/type";
import { cloneWithUnwrapProxy } from "@/helpers/cloneWithUnwrapProxy";
import { Track } from "@/store/type";
import { TrackId } from "@/type/preload";

export type RoutingState =
  | { status: "loading" }
  | { status: "loaded"; data: Routing };

const modelValue = defineModel<boolean>({ default: false });
const props = defineProps<{
  routingInfo: RoutingState;
  tracks: Record<TrackId, Track>;
  trackOrder: TrackId[];
}>();
const emit = defineEmits<{
  updateRoutingInfo: [routing: Routing];
}>();

const updateRoutingInfo = (
  trackId: TrackId,
  lr: number,
  channel: number,
  value: boolean,
) => {
  if (props.routingInfo.status === "loading") return;
  const newRouting = cloneWithUnwrapProxy(props.routingInfo.data);
  newRouting[trackId][lr][channel] = value;

  emit("updateRoutingInfo", newRouting);
};
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.dialog-card {
  width: 700px;
  max-width: 80vw;
}

.scrollable-area {
  max-height: 50vh;
  overflow: auto;

  :deep() {
    h3 {
      font-size: 1.3rem;
      font-weight: bold;
      margin: 0;
    }
  }
}

.spinner-container {
  display: grid;
  place-items: center;
}

.table-container {
  background: colors.$surface;
  display: grid;
  grid-template-columns: 200px auto repeat(32, max-content);
  gap: 4px;

  .track-name-header {
    grid-column: span 2;
    grid-row: span 2;
    font-weight: bold;
    align-self: center;
  }
  .channel-name-header {
    grid-column: span 2;
    text-align: center;
    font-weight: bold;
  }
  .channel-lr-header {
    text-align: center;
  }
  .track-name-item {
    grid-row: span 2;
    align-self: center;
  }
  .lr-indicator {
    text-align: center;
    padding-right: 4px;
  }
  .channel-item {
    &.left-channel {
      padding-left: 4px;
    }
  }
}
</style>
