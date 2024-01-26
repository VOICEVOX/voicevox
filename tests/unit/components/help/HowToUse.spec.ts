import { mount, flushPromises } from "@vue/test-utils";
import { createStore } from "vuex";
import { describe, it } from "vitest";
import { Quasar } from "quasar";
import { wrapQPage } from "../../utils";
import HowToUse from "@/components/help/HowToUse.vue";
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
    mount(wrapQPage(HowToUse), {
      global: {
        plugins: [markdownItPlugin, [store, storeKey], Quasar],
      },
    });
  });

  it("has how to use text", async () => {
    const wrapper = mount(wrapQPage(HowToUse), {
      global: {
        plugins: [markdownItPlugin, [store, storeKey], Quasar],
      },
    });

    await flushPromises();

    expect(wrapper.find(".markdown").text()).to.equal("test string");
  });
});
