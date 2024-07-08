<template>
  <QDialog
    v-model="modelValueComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="accept-retrieve-telemetry-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <div class="column">
            <QToolbarTitle class="text-display"
              >使いやすさ向上のためのお願い</QToolbarTitle
            >
          </div>

          <QSpace />

          <div class="row items-center no-wrap">
            <QBtn
              unelevated
              label="拒否"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap q-mr-md text-bold"
              @click="handler(false)"
            />

            <QBtn
              unelevated
              label="許可"
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
            VOICEVOXはより使いやすいソフトウェアを目指して開発されています。<br /><br />
            ボタンの配置換えなどの方針を決める際は、各UIの利用率などの情報が重要になります。<br />
            もしよろしければ、ソフトウェアの利用状況のデータ収集にご協力お願いします。<br />
            <br />
            （入力されたテキストデータや音声データの情報は収集しておりませんのでご安心ください。）
          </p>
          <QCard flat bordered>
            <QCardSection>
              <div class="text-h5">プライバシーポリシー</div>
            </QCardSection>

            <QCardSection class="text-body1">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <div v-html="privacyPolicy"></div>
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

const handler = (acceptRetrieveTelemetry: boolean) => {
  store.dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
    acceptRetrieveTelemetry: acceptRetrieveTelemetry ? "Accepted" : "Refused",
  });

  modelValueComputed.value = false;
};

const md = useMarkdownIt();
const privacyPolicy = ref("");
onMounted(async () => {
  privacyPolicy.value = md.render(
    await store.dispatch("GET_PRIVACY_POLICY_TEXT"),
  );
});
</script>

<style scoped lang="scss">
.q-page {
  padding: 3rem;
}
</style>
