import { Plugin, inject, InjectionKey } from "vue";
import MarkdownIt from "markdown-it";
import { UnreachableError } from "@/type/utility";

const markdownItKey: InjectionKey<MarkdownIt> = Symbol("_markdownIt_");

export const useMarkdownIt = (): MarkdownIt => {
  const maybeMarkdownIt = inject(markdownItKey);
  if (!maybeMarkdownIt) {
    throw new UnreachableError("markdownItKey is not provided");
  }
  return maybeMarkdownIt;
};

export const markdownItPlugin: Plugin = {
  install(app) {
    const md = new MarkdownIt({
      html: true,
      linkify: true,
    });

    // 全てのリンクに_blankを付ける
    // https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
    const defaultRender =
      md.renderer.rules.link_open ??
      function (tokens, idx, options, _, self) {
        return self.renderToken(tokens, idx, options);
      };
    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      const aIdx = tokens[idx].attrIndex("target");

      if (aIdx < 0) {
        tokens[idx].attrPush(["target", "_blank"]);
      } else {
        const attrs = tokens[idx].attrs;
        if (attrs) attrs[aIdx][1] = "_blank";
        tokens[idx].attrs = attrs;
      }

      return defaultRender(tokens, idx, options, env, self);
    };

    app.provide(markdownItKey, md);
  },
};
