<template>
  <Presentation />
</template>

<script setup lang="ts">
import { computed } from "vue";
import Presentation from "./Presentation.vue";
import { useStore } from "@/store";

defineOptions({
  name: "SequencerGrid",
});

const store = useStore();
</script>
