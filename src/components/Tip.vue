<template>
  <div v-if="!tipConfirmed" style="z-index: 10">
    <q-banner class="bg-surface text-display" dense rounded inline-actions>
      <template v-slot:avatar>
        <q-icon name="info" color="primary" />
      </template>
      <slot></slot>
      <template v-slot:action>
        <q-btn
          color="primary"
          text-color="display-on-primary"
          label="OK"
          @click="tipConfirmed = true"
        />
      </template>
    </q-banner>
  </div>
</template>

<script lang="ts">
import { PropType, defineComponent, computed } from "vue";
import { ConfirmedTips } from "@/type/preload";
import { useStore } from "@/store";

export default defineComponent({
  name: "Tip",

  props: {
    tipKey: { type: String as PropType<keyof ConfirmedTips>, required: true },
  },

  setup(props) {
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

    return {
      tipConfirmed,
    };
  },
});
</script>
