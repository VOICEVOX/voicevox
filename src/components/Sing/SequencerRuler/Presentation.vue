<template>
  <div ref="sequencerRuler" class="sequencer-ruler" @click="onClick">
    <div class="sequencer-ruler-content" :style="{ width: `${props.width}px` }">
      <div class="sequencer-ruler-grid">
        <slot name="grid" />
      </div>
      <div class="sequencer-ruler-value-changes">
        <slot name="changes" />
      </div>
      <div class="sequencer-ruler-loop">
        <slot name="loop" />
      </div>
      <div
        class="sequencer-ruler-playhead"
        :style="{
          transform: `translateX(${props.playheadX}px)`,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineOptions({
  name: "RulerPresentation",
});

const props = defineProps<{
  width: number;
  playheadX: number;
  offset: number;
}>();

const emit = defineEmits<{
  click: [MouseEvent];
}>();

const sequencerRuler = ref<HTMLDivElement | null>(null);

const onClick = (event: MouseEvent) => {
  emit("click", event);
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;

.sequencer-ruler {
  background: var(--scheme-color-sing-ruler-surface);
  height: 40px;
  position: relative;
  overflow: hidden;
  z-index: vars.$z-index-sing-ruler;
  isolation: isolate; // ルーラー内で重なりを局所管理
}

.sequencer-ruler-content {
  position: relative;
  width: 100%;
  height: 100%;
}

.sequencer-ruler-grid {
  position: absolute;
  z-index: 0; // ルーラー内でベースとなるグリッド線
  pointer-events: none; // クリック無効
}

.sequencer-ruler-loop {
  position: absolute;
  z-index: 1; // ルーラー内でグリッド線が重なりの影響を受けないようにするため一番上に
  pointer-events: none; // クリック無効
}

.sequencer-ruler-value-changes {
  position: absolute;
  z-index: 2; // ルーラー内において一番上
}

.sequencer-ruler-playhead {
  position: absolute;
  top: 0;
  left: -1px;
  width: 2px;
  height: 100%;
  background: var(--scheme-color-inverse-surface);
  pointer-events: none;
  will-change: transform;
  z-index: vars.$z-index-sing-playhead;
}
</style>
