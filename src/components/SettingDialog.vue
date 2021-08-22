<template>
  <div>
    <p>Hello World</p>
  </div>
</template>

<script lang="ts">
import { Component, defineComponent } from "vue";
import { useStore } from "@/store";
import { settingStore } from "@/store/setting";

type Page = {
  name: string;
  component: Component;
};

export default defineComponent({
  name: "SettingDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup() {
    const store = useStore();

  }
});
</script>