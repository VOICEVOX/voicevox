<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar color="transparent">
        <q-toolbar-title class="text-secondary">通常設定</q-toolbar-title>
      </q-toolbar>
    </q-header>
    <q-page class="scroller">
      <div class="q-pa-md row items-start q-gutter-md">
        <q-card class="my-card">
          <q-card-section class="bg-teal">
            <div class="text-h5">Engine</div>
            <div class="text-subtitle2">
              You need a Nvidia GPU to enable GPU mode
            </div>
          </q-card-section>

          <q-separator />

          <div class="q-pa-md">
            <q-toggle v-model="value" color="teal" />
          </div>
        </q-card>

        <q-card class="my-card">
          <q-card-section class="bg-blue">
            <div class="text-h5">File Encoding</div>
            <div class="text-subtitle2">
              This will affect the text file you export with audio
            </div>
          </q-card-section>

          <q-separator />

          <div class="q-pa-md">
            <q-btn-toggle
              v-model="model"
              push
              flat
              toggle-color="blue"
              :options="[
                { label: 'Shift-JIS', value: 'one' },
                { label: 'UTF-8', value: 'two' },
              ]"
            />
          </div>
        </q-card>
        <q-card class="my-card">
          <q-card-section class="bg-amber">
            <div class="text-h5">Restore Default</div>
            <div class="text-subtitle2">
              Warning: <br />
              This operation can't be restored
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions align="right">
            <q-btn flat>Restore</q-btn>
          </q-card-actions>
        </q-card>
      </div>
    </q-page>
  </div>
</template>

<script lang="ts">
// TODO: engine, simple mode & its base dir settings
import { defineComponent, ref } from "vue";
export default defineComponent({
  name: "GeneralSetting",
  setup() {
    let useGPU = false;
    return {
      value: ref(useGPU),
      model: ref("one"),
    };
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
.my-card {
  width: 100%;
  max-width: 250px;
}
</style>
