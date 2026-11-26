import { createI18n } from "vue-i18n";

import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zhCN from "./locales/zh-CN.json";
import type { Locale } from "@/type/preload";

export const i18n = createI18n({
  legacy: false,
  locale: "ja",
  fallbackLocale: "ja",
  messages: {
    en,
    ja,
    "zh-CN": zhCN,
  },
  missingWarn: false,
  globalInjection: true,
  fallbackWarn: false,
});

export function setI18nLocale(locale: Locale): void {
  i18n.global.locale.value = locale;
}
