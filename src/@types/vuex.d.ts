// vuexのexportsにtypeがないのを回避するWorkaround。
// https://github.com/vuejs/vuex/issues/2213#issuecomment-1592267216
declare module "vuex" {
  export * from "vuex/types/index.d.ts";
  export * from "vuex/types/helpers.d.ts";
  export * from "vuex/types/logger.d.ts";
  export * from "vuex/types/vue.d.ts";
}
