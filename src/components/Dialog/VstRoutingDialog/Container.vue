<!--
  アップデート通知ダイアログのコンテナ。
  スキップしたバージョンより新しいバージョンがあれば、ダイアログを表示する。
-->

<template>
  <Presentation
    v-model="modelValue"
    :tracks
    :trackOrder
    :routingInfo
    @updateRoutingInfo="updateRoutingInfo"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Presentation from "./Presentation.vue";
import { Routing } from "@/backend/vst/type";
import { getRoutingInfo, setRoutingInfo } from "@/backend/vst/ipc";
import { useStore } from "@/store";

defineOptions({
  name: "VstRoutingDialog",
});

const modelValue = defineModel<boolean>();
const store = useStore();

const tracks = computed(() => Object.fromEntries(store.state.tracks));
const trackOrder = computed(() => store.state.trackOrder);

const routingInfo = ref<
  { status: "loading" } | { status: "loaded"; data: Routing }
>({
  status: "loading",
});

const updateRoutingInfo = (routing: Routing) => {
  void setRoutingInfo(routing);

  routingInfo.value = { status: "loaded", data: routing };
};

watch(
  () => modelValue.value,
  async (modelValue) => {
    if (modelValue) {
      routingInfo.value = { status: "loading" };
      routingInfo.value = { status: "loaded", data: await getRoutingInfo() };
    } else {
      routingInfo.value = { status: "loading" };
    }
  },
);
</script>
