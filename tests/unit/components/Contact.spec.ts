import { shallowMount } from "@vue/test-utils";
import ContactInfo from "@/components/ContactInfo.vue";

describe("ContactInfo.vue", () => {
  it("can mount", () => {
    shallowMount(ContactInfo);
  });
});
