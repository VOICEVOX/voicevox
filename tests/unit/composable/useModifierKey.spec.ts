import { mount } from "@vue/test-utils";
import { Ref } from "vue";
import {
  useCommandOrControlKey,
  useShiftKey,
} from "@/composables/useModifierKey";

import { isMac } from "@/helpers/platform";

describe("useModifierKey", () => {
  // テスト用のコンポーネント
  const mountWrapper = (func: (elem: HTMLElement) => Ref<boolean>) =>
    mount({
      setup: () => {
        const elem = document.createElement("div");
        return { elem, isActive: func(elem) };
      },
      render: () => null, // 警告防止
    });

  it("Shiftキーが押されている状態になる", async () => {
    const wrapper = mountWrapper(useShiftKey);
    const elem = wrapper.vm.elem as HTMLDivElement;

    // 押す
    elem.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    expect(wrapper.vm.isActive).toBe(true);

    // 離す
    elem.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
    expect(wrapper.vm.isActive).toBe(false);

    // もう一度押したあとblurさせる
    elem.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    elem.dispatchEvent(new Event("blur"));
    expect(wrapper.vm.isActive).toBe(false);
  });

  it("isMacに従ったキーが押されている状態になる", async () => {
    const wrapper = mountWrapper(useCommandOrControlKey);
    const elem = wrapper.vm.elem as HTMLDivElement;

    const key = isMac ? "Meta" : "Control";
    elem.dispatchEvent(new KeyboardEvent("keydown", { key }));
    expect(wrapper.vm.isActive).toBe(true);
  });
});
