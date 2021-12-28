import { State } from "@/store/type";

export function sanitizeFileName(fileName: string): string {
  // \x00 - \x1f: ASCII 制御文字
  //   \x00: Null
  //   ...
  //   \x1f: Unit separator
  // \x22: "
  // \x2a: *
  // \x2f: /
  // \x3a: :
  // \x3c: <
  // \x3e: >
  // \x3f: ?
  // \x5c: \
  // \x7c: |
  // \x7f: DEL

  // eslint-disable-next-line no-control-regex
  const sanitizer = /[\x00-\x1f\x22\x2a\x2f\x3a\x3c\x3e\x3f\x5c\x7c\x7f]/g;

  return fileName.replace(sanitizer, "");
}

export function buildProjectFileName(state: State, extension?: string): string {
  const headItemText = state.audioItems[state.audioKeys[0]].text;

  const tailItemText =
    state.audioItems[state.audioKeys[state.audioKeys.length - 1]].text;

  const headTailItemText =
    headItemText !== tailItemText
      ? headItemText + "..." + tailItemText
      : headItemText;

  let defaultFileNameStem = sanitizeFileName(headTailItemText);

  if (defaultFileNameStem === "") {
    defaultFileNameStem = "Untitled";
  }

  return extension
    ? `${defaultFileNameStem}.${extension}`
    : defaultFileNameStem;
}
