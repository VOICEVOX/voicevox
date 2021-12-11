<template>
  <q-dialog :model-value="openDialog" @update:model-value="updateOpenDialog">
    <q-card class="setting-card q-pa-md dialog-card">
      <q-card-section>
        <div class="text-h5">プリセット管理</div>
      </q-card-section>
      <q-card-actions class="q-px-md q-py-sm">
        <div class="full-width row wrap justify-between">
          <q-list bordered separator class="col-sm-grow">
            <q-item v-for="item in presetList" :key="item.name">
              <q-item-section>{{ item.name }}</q-item-section>
              <q-space />
              <q-item-section avatar>
                <q-btn
                  icon="delete"
                  flat
                  color="grey-9"
                  @click="deletePreset(item.key)"
                ></q-btn>
              </q-item-section>
            </q-item>
            <q-item v-if="presetList.length === 0">
              <q-item-section class="text-grey-8">
                プリセットがありません
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "PresetManageDialog",

  props: {
    openDialog: Boolean,
  },

  emits: ["update:openDialog"],

  setup(props, context) {
    const updateOpenDialog = (isOpen: boolean) =>
      context.emit("update:openDialog", isOpen);

    const store = useStore();

    const presetItems = computed(() => store.state.presetItems);
    const presetKeys = computed(() => store.state.presetKeys);

    const presetList = computed(() =>
      presetKeys.value
        .filter((key) => presetItems.value[key] != undefined)
        .map((key) => ({
          key,
          ...presetItems.value[key],
        }))
    );

    const deletePreset = (key: string) => {
      store
        .dispatch("OPEN_COMMON_DIALOG", {
          title: "プリセット削除の確認",
          message: `プリセット "${presetItems.value[key].name}" を削除してもよろしいですか？`,
          cancelable: true,
        })
        .then((result) => {
          if (!result || result.result !== "ok") return;
          store.dispatch("DELETE_PRESET", { presetKey: key });
        });
    };

    return {
      updateOpenDialog,
      presetList,
      deletePreset,
    };
  },
});
</script>

<style>
.dialog-card {
  width: 700px;
  max-width: 80vw;
}
</style>
