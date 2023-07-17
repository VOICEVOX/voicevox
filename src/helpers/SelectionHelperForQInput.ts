import { QInput } from "quasar";
import { Ref } from "vue";

/**
 * QInput の選択範囲への操作を簡単にできるようにするクラス
 */
export class SelectionHelperForQInput {
  private _nativeEl: HTMLInputElement | undefined = undefined;

  constructor(private textfield: Ref<QInput | undefined>) {}

  // this.start が number | null なので null も受け付ける
  setCursorPosition(index: number | null) {
    if (index === null) return;

    this.nativeEl.selectionStart = this.nativeEl.selectionEnd = index;
  }

  getReplacedStringTo(str: string, allowInsertOnly = false) {
    if (!allowInsertOnly && this.isEmpty) {
      return this.nativeEl.value;
    }

    return `${this.startFragment}${str}${this.endFragment}`;
  }

  getAsString() {
    return this.nativeEl.value.substring(
      this.nativeEl.selectionStart ?? 0,
      this.nativeEl.selectionEnd ?? 0
    );
  }

  toEmpty() {
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

  get startFragment() {
    return this.nativeEl.value.substring(0, this.nativeEl.selectionStart ?? 0);
  }

  get endFragment() {
    return this.nativeEl.value.substring(this.nativeEl.selectionEnd ?? 0);
  }

  get isEmpty() {
    const start = this.nativeEl.selectionStart;
    const end = this.nativeEl.selectionEnd;
    return start === null || end === null || start === end;
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
