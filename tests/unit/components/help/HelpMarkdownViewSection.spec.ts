import { mount, flushPromises } from "@vue/test-utils";
import { describe, it } from "vitest";
import HelpMarkdownViewSection from "@/components/Dialog/HelpDialog/HelpMarkdownViewSection.vue";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";

describe("HelpMarkdownViewSection.vue", () => {
  it("can mount", () => {
    mount(HelpMarkdownViewSection, {
      global: {
        plugins: [markdownItPlugin],
      },
      props: {
        markdown: "",
      },
    });
  });

  it("has markdown text", async () => {
    const wrapper = mount(HelpMarkdownViewSection, {
      global: {
        plugins: [markdownItPlugin],
      },
      props: {
        markdown: "# title",
      },
    });

    await flushPromises();

    expect(wrapper.find("h1").text()).to.equal("title");
  });
});
