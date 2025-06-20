/**
 * items[beforeIndex]を基準に、selectedItemsをafterIndexの位置に移動する。
 *
 * 以下の場合は例外を投げる：
 * - items内の要素が重複している
 * - selectedItems内にitemsに存在しない要素がある
 * - beforeIndexやafterIndexが範囲外
 * - items[beforeIndex]がselectedItemsに含まれていない
 */
export function reorder<T>(
  items: readonly T[],
  selectedItems: Set<T>,
  beforeIndex: number,
  afterIndex: number,
): T[] {
  // Validate inputs
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

  // selectedItemsをitems[afterIndex]の位置に移動する
  const beforePivotSelectedItems = orderedSelectedItems.slice(
    0,
    orderedSelectedItems.indexOf(pivotItem),
  );
  const afterPivotSelectedItems = orderedSelectedItems.slice(
    orderedSelectedItems.indexOf(pivotItem) + 1,
  );

  const newItems = [
    ...clonedItems
      .slice(0, afterIndex)
      .filter((item) => !selectedItems.has(item)),
    ...beforePivotSelectedItems,
    pivotItem,
    ...afterPivotSelectedItems,
    ...clonedItems.slice(afterIndex).filter((item) => !selectedItems.has(item)),
  ];

  return newItems;
}
