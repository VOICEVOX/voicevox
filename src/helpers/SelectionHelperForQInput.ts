import { QInput } from "quasar";
import { Ref } from "vue";

/**
 * QInput の選択範囲への操作を簡単にできるようにするクラス
 */
export class SelectionHelperForQInput {
  constructor(private textfield: Ref<QInput | undefined>) {}

  // this.start が number | null なので null も受け付ける
  setCursorPosition(index: number | null) {
    if (index == undefined) return;

    const nativeEl = this.getNativeEl();
    nativeEl.selectionStart = nativeEl.selectionEnd = index;
  }

  getReplacedStringTo(str: string) {
    return `${this.substringBefore}${str}${this.substringAfter}`;
  }

  getAsString() {
    const nativeEl = this.getNativeEl();
    return nativeEl.value.substring(
      nativeEl.selectionStart ?? 0,
      nativeEl.selectionEnd ?? 0,
    );
  }

  toEmpty() {
    const nativeEl = this.getNativeEl();
    nativeEl.selectionEnd = nativeEl.selectionStart;
  }

  get selectionStart() {
    const nativeEl = this.getNativeEl();
    return nativeEl.selectionStart;
  }

  get selectionEnd() {
    const nativeEl = this.getNativeEl();
    return nativeEl.selectionEnd;
  }

  get substringBefore() {
    const nativeEl = this.getNativeEl();
    return nativeEl.value.substring(0, nativeEl.selectionStart ?? 0);
  }

  get substringAfter() {
    const nativeEl = this.getNativeEl();
    return nativeEl.value.substring(nativeEl.selectionEnd ?? 0);
  }

  get isEmpty() {
    const nativeEl = this.getNativeEl();
    const start = nativeEl.selectionStart;
    const end = nativeEl.selectionEnd;
    return start == undefined || end == undefined || start === end;
  }

  /**
   * 不具合修正のため、nativeElはキャッシュせず、常に新しく取得し直す
   * 参照: https://github.com/VOICEVOX/voicevox/pull/2156#discussion_r1718659808
   */
  private getNativeEl() {
    const nativeEl = this.textfield.value?.nativeEl;
    if (!(nativeEl instanceof HTMLInputElement)) {
      throw new Error("nativeElの取得に失敗しました。");
    }
    return nativeEl;
  }
}
