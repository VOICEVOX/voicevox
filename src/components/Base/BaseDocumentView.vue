<template>
  <div class="document">
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/mixin" as mixin;
@use "@/styles/colors-v2" as colors;

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
    border-bottom: 1px solid colors.$border;
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

  :deep(div > ul),
  :deep(div > ol) {
    margin-top: 1rem;
  }

  :deep(li) {
    line-height: 1.75;
    margin-top: 0.25rem;
  }

  :deep(a) {
    color: colors.$display-link;

    &:focus-visible {
      @include mixin.on-focus;
    }
  }

  :deep(img) {
    margin-top: 0.5rem;
    border: 1px solid colors.$border;
    border-radius: vars.$radius-1;
    vertical-align: middle;
  }

  :deep(hr) {
    border: none;
    height: 1px;
    background-color: colors.$border;
    margin-top: 2rem;
    margin-bottom: 2rem;
  }

  :deep(pre) {
    padding: vars.$padding-1;
    margin-top: 1rem;
    background-color: colors.$surface;
    border: 1px solid colors.$border;
    border-radius: vars.$radius-1;
  }

  :deep(:not(pre) > code) {
    padding: 4px;
    background-color: colors.$surface;
    border: 1px solid colors.$border;
    border-radius: 4px;
  }

  :deep(details) {
    padding: vars.$padding-1;
    background-color: colors.$surface;
    border: 1px solid colors.$border;
    border-radius: vars.$radius-1;
  }

  :deep(summary) {
    padding: vars.$padding-1;
    margin: calc(#{vars.$padding-1} * -1);
    cursor: pointer;
  }

  :deep(summary::before) {
    content: "▶ ";
  }

  :deep(details[open] > summary::before) {
    content: "▼ ";
  }
}
</style>
