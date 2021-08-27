<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar color="transparent">
        <q-toolbar-title class="text-secondary">通常設定</q-toolbar-title>
      </q-toolbar>
    </q-header>
    <q-page class="relarive-absolute-wrapper scroller">
      <div class="q-pa-md">
        <section>
          <q-badge color="primary"> placeholder </q-badge>
        </section>
      </div>
    </q-page>
  </div>
</template>

<script lang="ts">
// TODO: engine, simple mode & its base dir settings
import { defineComponent } from "vue";
export default defineComponent({
  name: "GeneralSetting",
  setup() {
    return;
  },
});
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}
</style>
