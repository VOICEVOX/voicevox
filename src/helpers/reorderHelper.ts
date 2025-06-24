/**
 * ドラッグ＆ドロップ操作において、選択された要素群を指定位置に移動する。
 *
 * 以下の場合は例外を投げる：
 * - items内の要素が重複している
 * - selectedItems内にitemsに存在しない要素がある
 * - beforeIndexやafterIndexが範囲外
 * - items[beforeIndex]がselectedItemsに含まれていない
 */
export function dragAndDropReorder<T>(
  items: readonly T[],
  selectedItems: Set<T>,
  beforeIndex: number,
  afterIndex: number,
): T[] {
  // バリデーション
  if (new Set(items).size !== items.length) {
    throw new Error("items contains duplicate elements.");
  }
  if (!selectedItems.values().every((item) => items.includes(item))) {
    throw new Error("selectedItems contains elements not in items.");
  }
  if (beforeIndex < 0 || beforeIndex >= items.length) {
    throw new Error("beforeIndex is out of bounds.");
  }
  if (afterIndex < 0 || afterIndex >= items.length) {
    throw new Error("afterIndex is out of bounds.");
  }
  if (!selectedItems.has(items[beforeIndex])) {
    throw new Error("items[beforeIndex] is not in selectedItems.");
  }

  const pivotItem = items[beforeIndex];

  // selectedItemsをitems内の順序で並び変える
  const orderedSelectedItems = items.filter((item) => selectedItems.has(item));

  // items[beforeIndex]をafterIndexの位置に移動する
  const clonedItems = [...items];
  clonedItems.splice(beforeIndex, 1);
  clonedItems.splice(afterIndex, 0, pivotItem);

  const newItems = [
    ...clonedItems
      .slice(0, afterIndex)
      .filter((item) => !selectedItems.has(item)),
    ...orderedSelectedItems,
    ...clonedItems.slice(afterIndex).filter((item) => !selectedItems.has(item)),
  ];

  return newItems;
}
