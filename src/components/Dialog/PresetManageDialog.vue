<template>
  <QDialog :modelValue="props.openDialog" @update:modelValue="updateOpenDialog">
    <QCard class="setting-card q-pa-md dialog-card">
      <QCardSection>
        <div class="text-h5">プリセット管理</div>
      </QCardSection>
      <QCardActions class="q-px-md q-py-sm">
        <div class="full-width row wrap justify-between">
          <QList bordered separator class="col-sm-grow">
            <Draggable
              :modelValue="previewPresetList"
              itemKey="key"
              @update:modelValue="reorderPreset"
            >
              <template #item="{ element: item }">
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
            </Draggable>
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

<script setup lang="ts">
import { computed, ref } from "vue";
import Draggable from "vuedraggable";
import { useStore } from "@/store";

import { useDefaultPreset } from "@/composables/useDefaultPreset";
import { Preset, PresetKey } from "@/type/preload";

const props = defineProps<{
  openDialog: boolean;
}>();
const emit = defineEmits<{
  (e: "update:openDialog", val: boolean): void;
}>();

const updateOpenDialog = (isOpen: boolean) => emit("update:openDialog", isOpen);

const store = useStore();
const { isDefaultPresetKey } = useDefaultPreset();

const presetItems = computed(() => store.state.presetItems);
const presetKeys = computed(() => store.state.presetKeys);

const presetList = computed(() =>
  presetKeys.value
    .filter((key) => presetItems.value[key] != undefined)
    .filter((key) => !isDefaultPresetKey(key))
    .map((key) => ({
      key,
      ...presetItems.value[key],
    })),
);

const isPreview = ref(false);
const previewPresetKeys = ref(store.state.presetKeys);

const previewPresetList = computed(() =>
  isPreview.value
    ? previewPresetKeys.value
        .filter((key) => presetItems.value[key] != undefined)
        .filter((key) => !isDefaultPresetKey(key))
        .map((key) => ({
          key,
          ...presetItems.value[key],
        }))
    : presetList.value,
);

const reorderPreset = (featurePresetList: (Preset & { key: PresetKey })[]) => {
  const newPresetKeys = featurePresetList.map((item) => item.key);
  previewPresetKeys.value = newPresetKeys;
  isPreview.value = true;

  // デフォルトプリセットは表示するlistから除外しているので、末尾に追加しておかないと失われる
  const defaultPresetKeys = presetKeys.value.filter(isDefaultPresetKey);

  store
    .dispatch("SAVE_PRESET_ORDER", {
      presetKeys: [...newPresetKeys, ...defaultPresetKeys],
    })
    .finally(() => (isPreview.value = false));
};

const deletePreset = async (key: PresetKey) => {
  const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
    title: "プリセット削除の確認",
    message: `プリセット "${presetItems.value[key].name}" を削除してもよろしいですか？`,
    actionName: "削除",
  });
  if (result === "OK") {
    await store.dispatch("DELETE_PRESET", {
      presetKey: key,
    });
  }
};
</script>

<style scoped lang="scss">
.dialog-card {
  width: 700px;
  max-width: 80vw;
}
</style>
