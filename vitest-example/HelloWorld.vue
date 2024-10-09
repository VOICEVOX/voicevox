<script setup lang="ts">
defineProps<{
  name: string
}>()
</script>

<template>
  <div>
    <h1>Hello {{ name }}!</h1>
  </div>
</template>
