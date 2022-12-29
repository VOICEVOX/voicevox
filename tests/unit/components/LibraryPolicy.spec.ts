import { mount, VueWrapper } from "@vue/test-utils";
import LibraryPolicy from "@/components/LibraryPolicy.vue";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { createStore } from "vuex";
import { storeKey } from "@/store";
import { QBtn, QItem, QItemLabel, Quasar } from "quasar";
import { expect } from "chai";
import { multipleEngineState, singleEngineState } from "../engines";
import { wrapQPage } from "../utils";
import { ComponentPublicInstance } from "vue";

const actions = {};
const getters = {};

const singleStore = createStore({
  actions: {
    ...actions,
    GET_SORTED_ENGINE_INFOS: async () => {
      return singleEngineState.engineInfos;
    },
  },
  state: singleEngineState,
  getters,
});

const multipleEngineStore = createStore({
  actions: {
    ...actions,
    GET_SORTED_ENGINE_INFOS: async () => {
      return multipleEngineState.engineInfos;
    },
  },
  state: multipleEngineState,
  getters,
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
