<template>
  <QAvatar size="2rem" v-bind="attr">
    <QImg no-spinner no-transition :ratio="1" :src="props.style.iconPath" />
    <QAvatar v-if="props.showEngineIcon" rounded class="engine-icon">
      <img :src="props.engineIcons[props.style.engineId]" />
    </QAvatar>
  </QAvatar>
</template>
<script setup lang="ts">
import { useAttrs } from "vue";
import { StyleInfo } from "@/type/preload";

const attr = useAttrs();
const props =
  defineProps<{
    style: StyleInfo;
    showEngineIcon: boolean;
    engineIcons: Record<string, string>;
  }>();
</script>
<style scoped lang="scss">
.engine-icon {
  position: absolute;
  width: 13px;
  height: 13px;
  bottom: -6px;
  right: -6px;
}
</style>
