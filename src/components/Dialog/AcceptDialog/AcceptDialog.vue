<template>
  <QDialog
    v-model="modelValueComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <div class="column">
            <QToolbarTitle class="text-display">{{ title }}</QToolbarTitle>
          </div>

          <QSpace />

          <div class="row items-center no-wrap">
            <QBtn
              unelevated
              :label="rejectLabel"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap q-mr-md text-bold"
              @click="$emit('reject')"
            />

            <QBtn
              unelevated
              :label="acceptLabel"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap text-bold"
              @click="$emit('accept')"
            />
          </div>
        </QToolbar>
      </QHeader>

      <QPageContainer>
        <QPage>
          <div class="container">
            <BaseScrollArea>
              <div class="inner">
                <div>
                  <slot />
                </div>
                <h2 class="headline">{{ heading }}</h2>
                <div class="terms">
                  <BaseDocumentView>
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div v-html="termsHtml" />
                  </BaseDocumentView>
                </div>
              </div>
            </BaseScrollArea>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";
import BaseDocumentView from "@/components/Base/BaseDocumentView.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";

const props = defineProps<{
  modelValue: boolean;
  title: string;
  heading: string;
  terms: string;
  rejectLabel: string;
  acceptLabel: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  reject: [];
  accept: [];
}>();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const md = useMarkdownIt();
const termsHtml = computed(() => md.render(props.terms));
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.container {
  position: absolute;
  left: 0;
  right: 0;
  height: 100%;
  background-color: colors.$background;
  color: colors.$display;
}

.inner {
  padding: vars.$padding-2;
  max-width: 960px;
  margin: auto;
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
}

.headline {
  @include mixin.headline-1;
}

.terms {
  border: 1px solid colors.$border;
  border-radius: vars.$radius-2;
  padding: vars.$padding-2;
}
</style>
