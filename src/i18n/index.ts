import en from "./en";
import ja from "./ja";

export default {
  en: en,
  ja: ja,
};

export type MessageSchema = typeof ja | typeof en;

export type AvailableLocale = "ja" | "en";
