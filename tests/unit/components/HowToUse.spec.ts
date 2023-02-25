import { shallowMount } from "@vue/test-utils";
import { createStore } from "vuex";
import { QPage } from "quasar";
import { describe, it } from "vitest";
import HowToUse from "@/components/HowToUse.vue";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { storeKey } from "@/store";

const store = createStore({
  actions: {
    GET_HOW_TO_USE_TEXT: async () => {
      return "test string";
    },
  },
});

describe("HowToUse.vue", () => {
  it("can mount", () => {
    shallowMount(HowToUse, {
      global: {
        plugins: [markdownItPlugin, [store, storeKey]],
        components: {
          QPage: QPage,
        },
      },
    });
  });
});
