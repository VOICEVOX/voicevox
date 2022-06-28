import { shallowMount } from "@vue/test-utils";
import HowToUse from "@/components/HowToUse.vue";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { createStore } from "vuex";
import { storeKey } from "@/store";
import { QPage } from "quasar";

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
