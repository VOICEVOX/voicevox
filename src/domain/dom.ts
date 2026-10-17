import type { EditorFontType } from "@/type/preload";

/** フォントを設定する */
export function setFontToCss(font: EditorFontType) {
  document.body.setAttribute("data-editor-font", font);
}
