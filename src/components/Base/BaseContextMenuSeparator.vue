<template>
  <ContextMenuSeparator class="ContextMenuSeparator" />
</template>

<script setup lang="ts">
import { ContextMenuSeparator } from "reka-ui";
</script>

<style lang="scss" scoped>
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

.ContextMenuSeparator {
  height: 1px;
  background-color: colors.$border;
  margin-block: vars.$padding-1;
}
</style>
