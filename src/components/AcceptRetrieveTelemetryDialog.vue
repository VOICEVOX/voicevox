<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="accept-retrieve-telemetry-dialog"
    v-model="modelValueComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title class="text-display"
              >テレメトリーの収集</q-toolbar-title
            >
          </div>

          <q-space />

          <div class="row items-center no-wrap">
            <q-btn
              unelevated
              label="拒否"
              color="background-light"
              text-color="display-dark"
              class="text-no-wrap q-mr-md"
              @click="handler(false)"
            />

            <q-btn
              unelevated
              label="許可"
              color="background-light"
              text-color="display-dark"
              class="text-no-wrap"
              @click="handler(true)"
            />
          </div>
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page>
          <div class="text-body1 q-mb-lg">
            VOICEVOXでは、利便性の向上のため、ウインドウサイズや各UIの利用率などの情報をGoogle
            Analyticsを用いて収集、分析に使用します。
          </div>
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
import { useGtm } from "@gtm-support/vue-gtm";
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

    const gtm = useGtm();
    const handler = (acceptRetrieveTelemetry: boolean) => {
      store.dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
        acceptRetrieveTelemetry: acceptRetrieveTelemetry
          ? "Accepted"
          : "Refused",
      });
      gtm?.enable(acceptRetrieveTelemetry);

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
