import { mount, VueWrapper } from "@vue/test-utils";
import { createStore } from "vuex";
import { Quasar, QBtn, QItem, QItemLabel } from "quasar";
import { describe, it, beforeEach, expect } from "vitest";
import { ComponentPublicInstance } from "vue";
import { multipleEngineState, singleEngineState } from "../dummyEngines";
import { wrapQPage } from "../utils";
import { storeKey } from "@/store";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import LibraryPolicy from "@/components/LibraryPolicy.vue";

const singleStore = createStore({
  state: singleEngineState,
  getters: {
    GET_SORTED_ENGINE_INFOS: () => {
      return [...Object.values(singleEngineState.engineInfos)];
    },
  },
});

const multipleEngineStore = createStore({
  state: multipleEngineState,
  getters: {
    GET_SORTED_ENGINE_INFOS: () => {
      return [...Object.values(multipleEngineState.engineInfos)];
    },
  },
});

const mountComponent = (multipleEngine: boolean) => {
  return mount(wrapQPage(LibraryPolicy), {
    global: {
      plugins: [
        markdownItPlugin,
        [multipleEngine ? multipleEngineStore : singleStore, storeKey],
        Quasar,
      ],
    },
  });
};
describe("LibraryPolicy.vue", () => {
  let wrapper: VueWrapper<ComponentPublicInstance>;
  beforeEach(() => {
    wrapper = mountComponent(false);
  });

  it("can mount", () => {
    expect(wrapper.exists()).to.be.true;
  });

  describe("single engine", () => {
    it("doesn't have engine name", () => {
      expect(wrapper.findComponent(QItemLabel).exists()).to.be.false;
    });
  });
  describe("multiple engine", () => {
    it("have engine name", () => {
      const wrapper = mountComponent(true);
      expect(
        wrapper.findAllComponents(QItemLabel).map((e) => e.text())
      ).to.deep.equal(["Engine 1", "Engine 2"]);
    });
  });

  it("shows policy", async () => {
    const wrapper = mountComponent(false);
    await wrapper.findComponent(QItem).trigger("click");

    expect(wrapper.find(".markdown").text()).to.equal("CV1の利用規約");
  });

  it("returns to list", async () => {
    const wrapper = mountComponent(false);
    await wrapper.findComponent(QItem).trigger("click");

    await wrapper.findComponent(QBtn).trigger("click");
    expect(wrapper.findComponent(QItem).exists()).to.be.true;
  });
});
