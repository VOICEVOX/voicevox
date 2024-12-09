/**
 * テキスト編集エリアの右クリックメニュー用の処理
 * 参考実装: https://github.com/VOICEVOX/voicevox/pull/1374/files#diff-444f263f72d4db11fe82c672d5c232eb4c29d29dbc1ffd20e279d586b1b2c180
 */

import { QInput } from "quasar";
import { ref, Ref, nextTick } from "vue";
import { MenuItemButton, MenuItemSeparator } from "@/components/Menu/type";
import ContextMenu from "@/components/Menu/ContextMenu/Container.vue";
import { SelectionHelperForQInput } from "@/helpers/SelectionHelperForQInput";

/**
 * <QInput> に対して切り取りやコピー、貼り付けの処理を行う
 */
export function useRightClickContextMenu(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  contextMenuRef: Ref<InstanceType<typeof ContextMenu> | undefined>,
  qInputRef: Ref<QInput | undefined>,
  inputText: Ref<string>,
) {
  const inputSelection = new SelectionHelperForQInput(qInputRef);

  /**
   * コンテキストメニューの開閉によりFocusやBlurが発生する可能性のある間は`true`
   * no-focusを付けた場合と付けてない場合でタイミングが異なるため、両方に対応
   */
  const willFocusOrBlur = ref(false);

  const contextMenuHeader = ref<string | undefined>("");
  const startContextMenuOperation = () => {
    const MAX_HEADER_LENGTH = 15;
    const SHORTED_HEADER_FRAGMENT_LENGTH = 5;

    willFocusOrBlur.value = true;

    const getMenuItemButton = (label: string) => {
      const item = contextMenudata.value.find((item) => item.label === label);
      if (item?.type !== "button")
        throw new Error("コンテキストメニューアイテムの取得に失敗しました。");
      return item;
    };

    const text = inputSelection.getAsString();

    if (text.length > MAX_HEADER_LENGTH) {
      contextMenuHeader.value =
        text.length <= MAX_HEADER_LENGTH
          ? text
          : `${text.substring(
              0,
              SHORTED_HEADER_FRAGMENT_LENGTH,
            )} ... ${text.substring(
              text.length - SHORTED_HEADER_FRAGMENT_LENGTH,
            )}`;
    } else {
      contextMenuHeader.value = text;
    }

    if (inputSelection.isEmpty) {
      getMenuItemButton("切り取り").disabled = true;
      getMenuItemButton("コピー").disabled = true;
    } else {
      getMenuItemButton("切り取り").disabled = false;
      getMenuItemButton("コピー").disabled = false;
    }
  };

  const contextMenudata = ref<
    [
      MenuItemButton,
      MenuItemButton,
      MenuItemButton,
      MenuItemSeparator,
      MenuItemButton,
    ]
  >([
    {
      type: "button",
      label: "切り取り",
      onClick: async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        contextMenuRef.value?.hide();
        await handleCut();
      },
      disableWhenUiLocked: false,
    },
    {
      type: "button",
      label: "コピー",
      onClick: async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        contextMenuRef.value?.hide();
        await navigator.clipboard.writeText(inputSelection.getAsString());
      },
      disableWhenUiLocked: false,
    },
    {
      type: "button",
      label: "貼り付け",
      onClick: async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        contextMenuRef.value?.hide();
        await handlePaste();
      },
      disableWhenUiLocked: false,
    },
    { type: "separator" },
    {
      type: "button",
      label: "全選択",
      onClick: async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        contextMenuRef.value?.hide();
        qInputRef.value?.select();
      },
      disableWhenUiLocked: false,
    },
  ]);

  const handleCut = async () => {
    if (!inputSelection || inputSelection.isEmpty) return;

    const text = inputSelection.getAsString();
    const start = inputSelection.selectionStart;
    setText(inputSelection.getReplacedStringTo(""));
    await nextTick();
    void navigator.clipboard.writeText(text);
    inputSelection.setCursorPosition(start);
  };

  const setText = (text: string | number | null) => {
    if (typeof text !== "string") throw new Error("typeof text !== 'string'");
    inputText.value = text;
  };

  const handlePaste = async (options?: { text?: string }) => {
    // NOTE: 自動的に削除される文字があることを念の為考慮している
    // FIXME: 考慮は要らないかも
    const text = options ? options.text : await navigator.clipboard.readText();
    if (text == undefined) return;
    const beforeLength = inputText.value.length;
    const end = inputSelection.selectionEnd ?? 0;
    setText(inputSelection.getReplacedStringTo(text));
    await nextTick();
    inputSelection.setCursorPosition(
      end + inputText.value.length - beforeLength,
    );
  };

  /**
   * バグ修正用
   * 参考: https://github.com/VOICEVOX/voicevox/pull/1364#issuecomment-1620594931
   */
  const clearInputSelection = () => {
    if (!willFocusOrBlur.value) {
      inputSelection.toEmpty();
    }
  };

  const endContextMenuOperation = async () => {
    await nextTick();
    willFocusOrBlur.value = false;
  };

  return {
    contextMenuHeader,
    contextMenudata,
    startContextMenuOperation,
    clearInputSelection,
    endContextMenuOperation,
  };
}
