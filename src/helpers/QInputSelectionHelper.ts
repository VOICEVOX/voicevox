import { QInput } from "quasar";
import { Ref } from "vue";

/**
 * QInputの選択範囲への操作を簡単にできるようにするクラス
 */
export class QInputSelectionHelper {
  private _nativeEl: HTMLInputElement | undefined = undefined;

  constructor(private textfield: Ref<QInput | undefined>) {}

  // this.startがnumber | nullなのでnullも受け付ける
  setCursorPosition(index: number | null) {
    if (index === null) return;

    this.nativeEl.selectionStart = this.nativeEl.selectionEnd = index;
  }

  getReplacedStringTo(string: string, allowInsertOnly = false) {
    const start = this.nativeEl.selectionStart ?? 0;
    const end = this.nativeEl.selectionEnd ?? 0;
    if (!allowInsertOnly && start === end) {
      return this.nativeEl.value;
    }

    return `${this.nativeEl.value.substring(
      0,
      start
    )}${string}${this.nativeEl.value.substring(end)}`;
  }

  getAsString() {
    return this.nativeEl.value.substring(
      this.nativeEl.selectionStart ?? 0,
      this.nativeEl.selectionEnd ?? 0
    );
  }

  isEmpty() {
    const start = this.nativeEl.selectionStart;
    const end = this.nativeEl.selectionEnd;
    return start === null || end === null || start === end;
  }

  empty() {
    this.nativeEl.selectionEnd = this.nativeEl.selectionStart;
  }

  get nativeEl() {
    return this._nativeEl ?? this.getNativeEl();
  }

  get start() {
    return this.nativeEl.selectionStart;
  }

  get end() {
    return this.nativeEl.selectionEnd;
  }

  private getNativeEl() {
    const nativeEl = this.textfield.value?.nativeEl;
    if (!(nativeEl instanceof HTMLInputElement)) {
      throw new Error("nativeElの取得に失敗しました。");
    }
    this._nativeEl = nativeEl;
    return nativeEl;
  }
}
