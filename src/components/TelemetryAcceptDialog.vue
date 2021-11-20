<template>
  <q-dialog
    persistent
    transition-show="jump-up"
    transition-hide="jump-down"
    class="default-style-select-dialog"
    v-model="modelValueComputed"
  >
    <q-card>
      <q-card-section>
        <div class="text-h6">テレメトリーの収集について</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        利便性向上のため、ウインドウサイズや各UIの利用率などの情報をGoogle
        Analyticsを用いて収集、分析に使用します。
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          unelevated
          padding="xs md"
          text-color="display-dark"
          label="同意しない"
          @click="handleSaveAcceptRetrieveTelemetry(false)"
        />
        <q-btn
          unelevated
          padding="xs md"
          text-color="display-dark"
          label="同意する"
          color="primary"
          @click="handleSaveAcceptRetrieveTelemetry(true)"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "TelemetryAcceptDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();

    const modelValueComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const handleSaveAcceptRetrieveTelemetry = (
      acceptRetrieveTelemetry: boolean
    ) => {
      store.dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
        acceptRetrieveTelemetry,
      });
      modelValueComputed.value = false;
    };

    return {
      modelValueComputed,
      handleSaveAcceptRetrieveTelemetry,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;
</style>
