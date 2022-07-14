<template>
  <div v-if="!exposedTipConfirmed">
    <q-banner
      class="bg-display-light text-display"
      dense
      rounded
      inline-actions
    >
      <template v-slot:avatar>
        <q-icon name="info" color="primary" />
      </template>
      <slot></slot>
      <template v-slot:action>
        <q-btn
          color="primary"
          text-color="display"
          label="OK"
          @click="exposedTipConfirmed = true"
        />
      </template>
    </q-banner>
  </div>
</template>

<script lang="ts">
import { PropType, defineComponent } from "vue";
import { tipConfirmed } from "@/helpers/tipConfirmed";
import { ConfirmedTips } from "@/type/preload";

export default defineComponent({
  name: "Tip",

  props: {
    tipKey: { type: String as PropType<keyof ConfirmedTips>, required: true },
  },

  setup(props) {
    const exposedTipConfirmed = tipConfirmed(props.tipKey);

    return {
      exposedTipConfirmed,
    };
  },
});
</script>
