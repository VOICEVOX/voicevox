import {
  mount,
  flushPromises,
  DOMWrapper,
  enableAutoUnmount,
} from "@vue/test-utils";
import { describe, it } from "vitest";
import { Quasar } from "quasar";

import UpdateNotificationDialogPresentation from "@/components/UpdateNotificationDialog/Presentation.vue";

const mountUpdateNotificationDialogPresentation = async (context?: {
  latestVersion?: string;
  onSkipThisVersionClick?: (version: string) => void;
}) => {
  const latestVersion = context?.latestVersion ?? "1.0.0";
  const onSkipThisVersionClick =
    context?.onSkipThisVersionClick ?? (() => undefined);

  const wrapper = mount(UpdateNotificationDialogPresentation, {
    props: {
      modelValue: true,
      latestVersion,
      newUpdateInfos: [],
      onSkipThisVersionClick,
    },
    global: {
      plugins: [Quasar],
    },
  });
  await flushPromises();
  const domWrapper = new DOMWrapper(document.body); // QDialogを取得するワークアラウンド

  const buttons = domWrapper.findAll("button");

  const skipButton = buttons.find((button) => button.text().match(/スキップ/));
  if (skipButton == undefined) throw new Error("skipButton is undefined");

  const exitButton = buttons.find((button) => button.text().match(/閉じる/));
  if (exitButton == undefined) throw new Error("exitButton is undefined");

  return { wrapper, skipButton, exitButton };
};

describe("Presentation", () => {
  enableAutoUnmount(afterEach);

  it("マウントできる", async () => {
    mountUpdateNotificationDialogPresentation();
  });

  it("閉じるボタンを押すと閉じられる", async () => {
    const { wrapper, exitButton } =
      await mountUpdateNotificationDialogPresentation();
    await exitButton.trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[false]]);
  });

  it("スキップボタンを押すとコールバックが実行される", async () => {
    const onSkipThisVersionClick = vi.fn();
    const { skipButton } = await mountUpdateNotificationDialogPresentation({
      onSkipThisVersionClick,
    });
    await skipButton.trigger("click");
    expect(onSkipThisVersionClick).toHaveBeenCalled();
  });
});
