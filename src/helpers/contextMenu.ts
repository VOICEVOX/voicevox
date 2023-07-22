/**
 * コンテキストメニューの開閉由来のFocusやBlurの判別に使う。
 * no-focusがついていないメニューを開く場合には機能しないため注意。
 */
// no-focusがついていないメニューを開く時はrelatedTarget === nullになるため機能しない。
export const isRelatedToContextMenu = (event?: FocusEvent) => {
  return event !== undefined && isMenuItemOrChild(event.relatedTarget);
};

const isMenuItemOrChild = (element: EventTarget | null) =>
  isMenuItemChild(element) ||
  (element instanceof HTMLDivElement && isMenuItemChild(element?.firstChild));

const isMenuItemChild = (element: EventTarget | null) =>
  element instanceof HTMLDivElement &&
  element.classList.contains("q-focus-helper");
