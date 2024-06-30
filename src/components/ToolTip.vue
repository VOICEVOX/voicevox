<template>
  <div v-if="!tipConfirmed" style="z-index: 10">
    <QBanner class="bg-surface text-display" dense rounded inlineActions>
      <template #avatar>
        <QIcon name="info" color="primary" />
      </template>
      <slot></slot>
      <template #action>
        <QBtn
          color="primary"
          textColor="display-on-primary"
          label="OK"
          @click="tipConfirmed = true"
        />
      </template>
    </QBanner>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ConfirmedTips } from "@/type/preload";
import { useStore } from "@/store";

const props = defineProps<{
  tipKey: keyof ConfirmedTips;
}>();

const store = useStore();

const tipConfirmed = computed({
  get: () => store.state.confirmedTips[props.tipKey],
  set: (value) =>
    store.dispatch("SET_CONFIRMED_TIPS", {
      confirmedTips: {
        ...store.state.confirmedTips,
        [props.tipKey]: value,
      },
    }),
});
</script>
