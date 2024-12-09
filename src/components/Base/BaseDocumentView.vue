<template>
  <div class="document">
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.document {
  color: colors.$display;

  :deep(*) {
    margin: 0;
  }

  :deep(h1) {
    @include mixin.headline-1;
    margin-bottom: 2rem;
  }

  :deep(h2) {
    @include mixin.headline-2;
    padding-block: 0.5rem;
    margin-top: 2rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid colors.$border;
  }

  :deep(h3) {
    @include mixin.headline-3;
    margin-top: 1.75rem;
    margin-bottom: 1rem;
  }

  :deep(h4) {
    @include mixin.headline-4;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
  }

  :deep(h5) {
    @include mixin.headline-5;
    margin-top: 1rem;
    margin-bottom: 0.25rem;
  }

  :deep(h6) {
    @include mixin.headline-6;
    margin-top: 0.75rem;
  }

  :deep(p) {
    line-height: 1.75;
    margin-bottom: 1rem;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 1.5rem;
  }

  :deep(> ul),
  :deep(> ol),
  :deep(:where(div, details) > ul),
  :deep(:where(div, details) > ol) {
    margin-bottom: 1rem;
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
    border: 1px solid colors.$border;
    border-radius: vars.$radius-1;
    vertical-align: middle;
    max-width: 100%;
  }

  :deep(> img),
  :deep(:where(div, details) > img) {
    display: block;
    margin-bottom: 1rem;
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
    margin-bottom: 1rem;
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

  :deep(table) {
    border-collapse: separate;
    border-spacing: 0;
    border-radius: vars.$radius-1;
    border: 1px solid colors.$border;
  }

  :deep(tr) {
    height: vars.$size-control;
  }

  :deep(td),
  :deep(th) {
    padding-inline: vars.$padding-2;
  }

  :deep(td) {
    border-top: 1px solid colors.$border;
  }

  :deep(details) {
    margin-bottom: 1rem;
    padding: vars.$padding-2;
    background-color: colors.$surface;
    border: 1px solid colors.$border;
    border-radius: vars.$radius-1;
  }

  :deep(summary) {
    padding: vars.$padding-2;
    margin: calc(#{vars.$padding-2} * -1);
    cursor: pointer;
  }

  :deep(details[open] > summary) {
    margin-bottom: 0;
  }
  :deep(summary::before) {
    content: "▶ ";
  }

  :deep(details[open] > summary::before) {
    content: "▼ ";
  }

  :deep(:last-child) {
    margin-bottom: 0;
  }
}
</style>
