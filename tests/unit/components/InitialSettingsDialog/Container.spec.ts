import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Container from "@/components/Dialog/InitialSettingsDialog/Container.vue";
import type { EditorType } from "@/type/preload";

const { setRootMiscSettingMock, setDialogOpenMock } = vi.hoisted(() => ({
  setRootMiscSettingMock: vi.fn(),
  setDialogOpenMock: vi.fn(),
}));

vi.mock("@/store", () => ({
  useStore: () => ({
    state: {
      isInitialSettingsDialogOpen: true,
    },
    actions: {
      SET_ROOT_MISC_SETTING: setRootMiscSettingMock,
      SET_DIALOG_OPEN: setDialogOpenMock,
    },
  }),
}));

const PresentationStub = defineComponent({
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },
  emits: {
    select: (editor: EditorType) => editor === "talk" || editor === "song",
  },
  template: `
    <button data-editor="talk" @click="$emit('select', 'talk')">トーク</button>
    <button data-editor="song" @click="$emit('select', 'song')">ソング</button>
  `,
});

describe("InitialSettingsDialog Container", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setRootMiscSettingMock.mockResolvedValue(undefined);
    setDialogOpenMock.mockResolvedValue(undefined);
  });

  it.each<{ label: string; editor: EditorType }>([
    { label: "トーク", editor: "talk" },
    { label: "ソング", editor: "song" },
  ])(
    "$labelを選択すると設定を保存してダイアログを閉じる",
    async ({ editor }) => {
      const wrapper = mount(Container, {
        props: {
          canOpenDialog: true,
        },
        global: {
          stubs: {
            Presentation: PresentationStub,
          },
        },
      });

      await wrapper.get(`[data-editor="${editor}"]`).trigger("click");
      await flushPromises();

      expect(setRootMiscSettingMock).toHaveBeenCalledExactlyOnceWith({
        key: "openedEditor",
        value: editor,
      });
      expect(setDialogOpenMock).toHaveBeenCalledExactlyOnceWith({
        isInitialSettingsDialogOpen: false,
      });
      expect(setRootMiscSettingMock.mock.invocationCallOrder[0]).toBeLessThan(
        setDialogOpenMock.mock.invocationCallOrder[0],
      );
    },
  );

  it("表示を許可されるまではダイアログを表示しない", () => {
    const wrapper = mount(Container, {
      props: {
        canOpenDialog: false,
      },
      global: {
        stubs: {
          Presentation: PresentationStub,
        },
      },
    });

    expect(wrapper.findComponent(PresentationStub).props("modelValue")).toBe(
      false,
    );
  });
});
