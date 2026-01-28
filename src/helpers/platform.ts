import { ExhaustiveError } from "@/type/utility";

/**
 * コードが動いている環境を判定するためのユーティリティ。
 * Electronのメインプロセス、レンダラープロセス、ブラウザのどこでも使用可能。
 */
export const isProduction = import.meta.env.MODE === "production";
export const isElectron = import.meta.env.VITE_TARGET === "electron";
export const isBrowser = import.meta.env.VITE_TARGET === "browser";
export const isDevelopment = import.meta.env.DEV;
export const isTest = import.meta.env.MODE === "test";

// electronのメイン・レンダラープロセス内、ブラウザ内どこでも使用可能なOS判定
function checkOs(os: "windows" | "mac" | "linux"): boolean {
  let isSpecifiedOs: boolean | undefined = undefined;
  if (typeof process !== "undefined" && process?.platform) {
    // electronのメインプロセス用
    if (os === "windows") {
      isSpecifiedOs = process.platform === "win32";
    } else if (os === "mac") {
      isSpecifiedOs = process.platform === "darwin";
    } else if (os === "linux") {
      isSpecifiedOs = process.platform === "linux";
    } else {
      throw new ExhaustiveError(os);
    }
  } else if (navigator?.userAgentData) {
    // electronのレンダラープロセス用、Chrome系統が実装する実験的機能
    isSpecifiedOs = navigator.userAgentData.platform.toLowerCase().includes(os);
  } else if (navigator?.platform) {
    // ブラウザ用、非推奨機能
    isSpecifiedOs = navigator.platform.toLowerCase().includes(os);
  } else {
    // ブラウザ用、不正確
    isSpecifiedOs = navigator.userAgent.toLowerCase().includes(os);
  }
  return isSpecifiedOs;
}

export const isMac = checkOs("mac");
export const isWindows = checkOs("windows");
export const isLinux = checkOs("linux");

/** Nodeとして動いてほしいか */
export const isNode =
  // window.documentがなければNode
  typeof window == "undefined" ||
  typeof window.document == "undefined" ||
  // happy-domのときはNode
  typeof (window as { happyDOM?: unknown }).happyDOM != "undefined";
