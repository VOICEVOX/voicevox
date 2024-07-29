<template>
  <QDialog
    v-model="modelValueComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="accept-terms-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <div class="column">
            <QToolbarTitle class="text-display"
              >利用規約に関するお知らせ</QToolbarTitle
            >
          </div>

          <QSpace />

          <div class="row items-center no-wrap">
            <QBtn
              unelevated
              label="同意せずに終了"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap q-mr-md text-bold"
              @click="handler(false)"
            />

            <QBtn
              unelevated
              label="同意して使用開始"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap text-bold"
              @click="handler(true)"
            />
          </div>
        </QToolbar>
      </QHeader>

      <QPageContainer>
        <QPage>
          <p class="text-body1 q-mb-lg">
            多くの人が安心して VOICEVOX
            を使えるよう、利用規約への同意をお願いします。
          </p>
          <QCard flat bordered>
            <QCardSection>
              <div class="text-h5">利用規約</div>
            </QCardSection>

            <QCardSection>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div class="q-pa-md markdown markdown-body" v-html="terms" />
            </QCardSection>
          </QCard>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const store = useStore();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const handler = (acceptTerms: boolean) => {
  store.dispatch("SET_ACCEPT_TERMS", {
    acceptTerms: acceptTerms ? "Accepted" : "Rejected",
  });
  !acceptTerms
    ? store.dispatch("CHECK_EDITED_AND_NOT_SAVE", { closeOrReload: "close" })
    : undefined;

  modelValueComputed.value = false;
};

const md = useMarkdownIt();
const terms = ref("");
onMounted(async () => {
  terms.value = md.render(await store.dispatch("GET_POLICY_TEXT"));
});
</script>

<style scoped lang="scss">
.q-page {
  padding: 3rem;
}
</style>
