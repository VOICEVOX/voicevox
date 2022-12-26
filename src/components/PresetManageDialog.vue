<script setup lang="ts">
import { computed, ref } from "vue";
import { useQuasar } from "quasar";
import { useStore } from "@/store";
import draggable from "vuedraggable";

import { Preset } from "@/type/preload";

defineProps<{
  openDialog: boolean;
}>();
const emit =
  defineEmits<{
    (e: "update:openDialog", val: boolean): void;
  }>();
const updateOpenDialog = (isOpen: boolean) => emit("update:openDialog", isOpen);

const store = useStore();
const $q = useQuasar();

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

const isPreview = ref(false);
const previewPresetKeys = ref(store.state.presetKeys);

const previewPresetList = computed(() =>
  isPreview.value
    ? previewPresetKeys.value
        .filter((key) => presetItems.value[key] != undefined)
        .map((key) => ({
          key,
          ...presetItems.value[key],
        }))
    : presetList.value
);

const reorderPreset = (featurePresetList: (Preset & { key: string })[]) => {
  const newPresetKeys = featurePresetList.map((item) => item.key);
  previewPresetKeys.value = newPresetKeys;
  isPreview.value = true;
  store
    .dispatch("SAVE_PRESET_ORDER", {
      presetKeys: newPresetKeys,
    })
    .finally(() => (isPreview.value = false));
};

const deletePreset = (key: string) => {
  $q.dialog({
    title: "プリセット削除の確認",
    message: `プリセット "${presetItems.value[key].name}" を削除してもよろしいですか？`,
    cancel: true,
  }).onOk(async () => {
    await store.dispatch("DELETE_PRESET", {
      presetKey: key,
    });
  });
};
</script>

<template>
  <QDialog :model-value="openDialog" @update:model-value="updateOpenDialog">
    <QCard class="setting-card q-pa-md dialog-card">
      <QCardSection>
        <div class="text-h5">プリセット管理</div>
      </QCardSection>
      <QCardActions class="q-px-md q-py-sm">
        <div class="full-width row wrap justify-between">
          <QList bordered separator class="col-sm-grow">
            <draggable
              :modelValue="previewPresetList"
              @update:modelValue="reorderPreset"
              item-key="key"
            >
              <template v-slot:item="{ element: item }">
                <QItem>
                  <QItemSection>{{ item.name }}</QItemSection>
                  <QSpace />
                  <QItemSection avatar>
                    <QBtn
                      icon="delete"
                      flat
                      color="display"
                      @click="deletePreset(item.key)"
                    ></QBtn>
                  </QItemSection>
                </QItem>
              </template>
            </draggable>
            <QItem v-if="presetList.length === 0">
              <QItemSection class="display">
                プリセットがありません
              </QItemSection>
            </QItem>
          </QList>
        </div>
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<style>
.dialog-card {
  width: 700px;
  max-width: 80vw;
}
</style>
