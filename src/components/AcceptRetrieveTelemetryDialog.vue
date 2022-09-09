<template>
  <q-dialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="accept-retrieve-telemetry-dialog transparent-backdrop"
    v-model="modelValueComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title class="text-display"
              >使いやすさ向上のためのお願い</q-toolbar-title
            >
          </div>

          <q-space />

          <div class="row items-center no-wrap">
            <q-btn
              unelevated
              label="拒否"
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap q-mr-md text-bold"
              @click="handler(false)"
            />

            <q-btn
              unelevated
              label="許可"
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap text-bold"
              @click="handler(true)"
            />
          </div>
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page>
          <p class="text-body1 q-mb-lg">
            VOICEVOXはより使いやすいソフトウェアを目指して開発されています。<br /><br />
            ボタンの配置換えなどの方針を決める際は、各UIの利用率などの情報が重要になります。<br />
            もしよろしければ、ソフトウェアの利用状況のデータ収集にご協力お願いします。<br />
            <br />
            （入力されたテキストデータや音声データの情報は収集しておりませんのでご安心ください。）
          </p>
          <q-card flat bordered>
            <q-card-section>
              <div class="text-h5">プライバシーポリシー</div>
            </q-card-section>

            <q-card-section class="text-body1">
              <div v-html="privacyPolicy"></div>
            </q-card-section>
          </q-card>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, onMounted } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

export default defineComponent({
  name: "AcceptRetrieveTelemetryDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();

    const modelValueComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const handler = (acceptRetrieveTelemetry: boolean) => {
      store.dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
        acceptRetrieveTelemetry: acceptRetrieveTelemetry
          ? "Accepted"
          : "Refused",
      });

      modelValueComputed.value = false;
    };

    const md = useMarkdownIt();
    const privacyPolicy = ref("");
    onMounted(async () => {
      privacyPolicy.value = md.render(
        await store.dispatch("GET_PRIVACY_POLICY_TEXT")
      );
    });

    return {
      modelValueComputed,
      handler,
      privacyPolicy,
    };
  },
});
</script>

<style scoped lang="scss">
.q-page {
  padding: 3rem;
}
</style>
