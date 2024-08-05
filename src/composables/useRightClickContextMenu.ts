import { QInput } from "quasar";
import { ref, Ref, nextTick } from "vue";
import { MenuItemButton, MenuItemSeparator } from "@/components/Menu/type";
import ContextMenu from "@/components/Menu/ContextMenu.vue";
import { SelectionHelperForQInput } from "@/helpers/SelectionHelperForQInput";

// テキスト編集エリアの右クリック
// 参考実装: https://github.com/VOICEVOX/voicevox/pull/1374/files#diff-444f263f72d4db11fe82c672d5c232eb4c29d29dbc1ffd20e279d586b1b2c180R371-R379

/**
 * surface と yomi のどちらを選択しているかを取得する。
 * 単語か読み、どちらの <QInput> であるかを区別し、
 * それに対する切り取りやコピー、貼り付けの処理を行う
 */
export function useRightClickContextMenu(
  qInputRef: Ref<QInput | undefined>,
  inputText: Ref<string>,
  inputField: Ref<string>,
) {
  const inputSelection = new SelectionHelperForQInput(qInputRef);

  /**
   * コンテキストメニューの開閉によりFocusやBlurが発生する可能性のある間は`true`
   * no-focusを付けた場合と付けてない場合でタイミングが異なるため、両方に対応
   */
  const willFocusOrBlur = ref(false);

  const contextMenu = ref<InstanceType<typeof ContextMenu>>();

  const contextMenuHeader = ref<string | undefined>("");
  const readyForContextMenu = () => {
    const MAX_HEADER_LENGTH = 15;
    const SHORTED_HEADER_FRAGMENT_LENGTH = 5;

    const getMenuItemButton = (label: string) => {
      const item = contextMenudata.value.find((item) => item.label === label);
      if (item?.type !== "button")
        throw new Error("コンテキストメニューアイテムの取得に失敗しました。");
      return item;
    };

    const text = inputSelection.getAsString();
    if (text.length === 0) {
      getMenuItemButton("切り取り").disabled = true;
      getMenuItemButton("コピー").disabled = true;
    } else {
      getMenuItemButton("切り取り").disabled = false;
      getMenuItemButton("コピー").disabled = false;
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
        contextMenu.value?.hide();
        await handleCut();
      },
      disableWhenUiLocked: false,
    },
    {
      type: "button",
      label: "コピー",
      onClick: async () => {
        contextMenu.value?.hide();
        if (inputSelection) {
          await navigator.clipboard.writeText(inputSelection.getAsString());
        }
      },
      disableWhenUiLocked: false,
    },
    {
      type: "button",
      label: "貼り付け",
      onClick: async () => {
        contextMenu.value?.hide();
        await handlePaste();
      },
      disableWhenUiLocked: false,
    },
    { type: "separator" },
    {
      type: "button",
      label: "全選択",
      onClick: async () => {
        contextMenu.value?.hide();
        qInputRef.value?.select();
      },
      disableWhenUiLocked: false,
    },
  ]);

  const handleCut = async () => {
    if (!inputSelection || inputSelection.isEmpty) return;

    const text = inputSelection.getAsString();
    const start = inputSelection.selectionStart;
    setSurfaceOrYomiText(
      inputSelection.getReplacedStringTo(""),
      inputField.value,
    );
    await nextTick();
    await navigator.clipboard.writeText(text);
    inputSelection.setCursorPosition(start);
  };

  const setSurfaceOrYomiText = (
    text: string | number | null,
    field: string,
  ) => {
    if (typeof text !== "string") throw new Error("typeof text !== 'string'");
    if (field !== "surface" && field !== "yomi") {
      throw new Error("field must be 'surface' or 'yomi'");
    }
    inputText.value = text;
  };

  const handlePaste = async (options?: { text?: string }) => {
    if (!inputSelection) return;

    const text = options ? options.text : await navigator.clipboard.readText();
    if (text == undefined) return;
    const beforeLength = inputText.value.length;
    const end = inputSelection.selectionEnd ?? 0;
    setSurfaceOrYomiText(
      inputSelection.getReplacedStringTo(text),
      inputField.value,
    );
    await nextTick();
    inputSelection.setCursorPosition(
      end + inputText.value.length - beforeLength,
    );
  };

  const clearInputSelection = () => {
    if (!willFocusOrBlur.value) {
      inputSelection.toEmpty();
    }
  };

  const startContextMenuOperation = () => {
    willFocusOrBlur.value = true;
  };

  const endContextMenuOperation = async () => {
    await nextTick();
    willFocusOrBlur.value = false;
  };

  return {
    contextMenu,
    contextMenuHeader,
    contextMenudata,
    readyForContextMenu,
    clearInputSelection,
    startContextMenuOperation,
    endContextMenuOperation,
  };
}
