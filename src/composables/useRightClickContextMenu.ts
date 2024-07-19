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
  inputElement: Ref<string>,
) {
  const inputSelection = new SelectionHelperForQInput(qInputRef);

  const handleFocus = (event: Event) => {
    const target = event.target as HTMLInputElement;
    inputElement.value = target.name;
    qInputRef.value = target as unknown as QInput;
  };

  const contextMenu = ref<InstanceType<typeof ContextMenu>>();
  const contextMenuHeader = ref<string | undefined>("");
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
        handleCut();
      },
      disableWhenUiLocked: false,
    },
    {
      type: "button",
      label: "コピー",
      onClick: () => {
        contextMenu.value?.hide();
        if (inputSelection) {
          navigator.clipboard.writeText(inputSelection.getAsString());
        }
      },
      disableWhenUiLocked: false,
    },
    {
      type: "button",
      label: "貼り付け",
      onClick: async () => {
        contextMenu.value?.hide();
        paste();
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
    setSurfaceOrYomiText(inputSelection.getReplacedStringTo(""));
    await nextTick();
    navigator.clipboard.writeText(text);
    inputSelection.setCursorPosition(start);
  };

  const setSurfaceOrYomiText = (text: string | number | null) => {
    if (typeof text !== "string") throw new Error("typeof text !== 'string'");
    inputElement.value = text;
  };

  const paste = async (options?: { text?: string }) => {
    if (!inputSelection) return;

    const text = options ? options.text : await navigator.clipboard.readText();
    if (text == undefined) return;
    const beforeLength = inputElement.value.length;
    const end = inputSelection.selectionEnd ?? 0;
    setSurfaceOrYomiText(inputSelection.getReplacedStringTo(text));
    await nextTick();
    inputSelection.setCursorPosition(
      end + inputElement.value.length - beforeLength,
    );
  };

  const pasteOnDic = async (event: ClipboardEvent) => {
    event.preventDefault();
    paste({ text: event.clipboardData?.getData("text/plain") });
  };

  return {
    handleFocus,
    contextMenu,
    contextMenuHeader,
    contextMenudata,
    setSurfaceOrYomiText,
    pasteOnDic,
  };
}
