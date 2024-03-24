<template>
  <div class="list">
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/mixin' as mixin;
@use '@/styles/new-colors' as colors;

.list {
  padding: vars.$padding-2;
  display: flex;
  flex-direction: column;
}
</style>
