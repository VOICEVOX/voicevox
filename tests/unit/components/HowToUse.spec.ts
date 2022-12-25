import { mount } from "@vue/test-utils";
import HowToUse from "@/components/HowToUse.vue";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { createStore } from "vuex";
import { storeKey } from "@/store";
import { waitTicks, wrapQPage } from "../utils";
import { Quasar } from "quasar";
import { expect } from "chai";

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

    await waitTicks(wrapper, 2); // onMounted、store.dispatch("GET_HOW_TO_USE_TEXT")

    expect(wrapper.find(".markdown").text()).to.equal("test string");
  });
});
