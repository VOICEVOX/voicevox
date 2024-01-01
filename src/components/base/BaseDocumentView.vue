<template>
  <div class="document">
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/colors' as colors;
@use '@/styles/mixin' as mixin;

.document {
  :deep(*) {
    margin: 0;
  }

  :deep(h1) {
    @include mixin.headline-1;
  }

  :deep(h2) {
    @include mixin.headline-2;
    margin-top: 1.5rem;
    border-bottom: 1px solid #0002;
  }

  :deep(h3) {
    @include mixin.headline-3;
    margin-top: 1.5rem;
  }

  :deep(h4) {
    @include mixin.headline-4;
    margin-top: 1.25rem;
  }

  :deep(h5) {
    @include mixin.headline-5;
    margin-top: 1rem;
  }

  :deep(h6) {
    @include mixin.headline-6;
    margin-top: 0.75rem;
  }

  :deep(p) {
    line-height: 1.75;
    margin-top: 1rem;
  }

  :deep(ul),
  :deep(ol) {
    margin-top: 1rem;
  }

  :deep(li) {
    line-height: 1.75;
    margin-top: 0.25rem;
  }

  :deep(a) {
    color: colors.$display-hyperlink;
  }

  :deep(img) {
    margin-top: 0.5rem;
    border: 1px solid #0002;
    border-radius: 8px;
    vertical-align: middle;
  }

  :deep(hr) {
    border: none;
    height: 1px;
    background-color: #0002;
    margin-top: 2rem;
    margin-bottom: 2rem;
  }

  :deep(pre) {
    padding: 8px;
    margin-top: 1rem;
    background-color: #e9f3e7;
    border-radius: 8px;
  }

  :deep(p > code) {
    padding: 4px;
    background-color: #e9f3e7;
    border-radius: 4px;
  }
}
</style>
