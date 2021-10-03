<template>
  <q-dialog :model-value="openDialog" @update:model-value="updateOpenDialog">
    <q-card class="setting-card q-pa-md" style="width: 700px; max-width: 80vw">
      <q-card-actions>
        <div class="text-h5">プリセット管理</div>
      </q-card-actions>
      <q-card-actions class="q-px-md q-py-sm">
        <div class="full-width row wrap justify-between">
          <q-select
            :options="speakerList"
            v-model="speakerSelect"
            class="col-md-4 col-sm-5 col -xs-10 q-pr-sm q-pb-sm"
            label="キャラクター"
          >
          </q-select>
          <q-list
            bordered
            separator
            class="bg-white col-md-grow col-sm-12"
            v-if="presetList !== undefined"
          >
            <q-item v-for="(item, index) in presetList" :key="item.name">
              <q-item-section>{{ item.name }}</q-item-section>
              <q-space></q-space>
              <q-item-section avatar>
                <q-btn
                  icon="delete"
                  flat
                  color="grey-9"
                  @click="deletePreset(item.key, index)"
                ></q-btn>
              </q-item-section>
            </q-item>
            <q-item v-if="presetList.length === 0">
              <q-item-section class="text-grey-8">
                プリセットがありません
              </q-item-section>
            </q-item>
          </q-list>
          <q-list v-else class="bg-white col-md-grow col-sm-12">
            <q-item>
              <q-item-section>
                <div>キャラクターを選択してください</div>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, toRef } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "PresetDialog",

  props: {
    openDialog: Boolean,
  },

  emits: ["update:openDialog"],

  setup(props, context) {
    const openDialogModel = toRef(props, "openDialog");
    const updateOpenDialog = (e: boolean) =>
      context.emit("update:openDialog", e);

    const store = useStore();

    const presetItems = computed(() => store.state.presetItems);
    const presetKeys = computed(() => store.state.presetKeys);

    const speakerList = computed(() =>
      store.state.characterInfos?.map((i) => ({
        label: i.metas.name,
        speaker: i.metas.speaker,
      }))
    );
    const speakerSelect = ref<{ label: string; speaker: number }>();

    const presetList = computed(() =>
      speakerSelect.value !== undefined
        ? presetKeys.value[speakerSelect.value.speaker]?.map((e) => ({
            ...presetItems.value[e],
            key: e,
          }))
        : undefined
    );

    const deletePreset = (key: string, index: number) => {
      if (speakerSelect.value === undefined) return;

      const newItems = { ...presetItems.value };
      delete newItems[key];

      const newKeys = { ...presetKeys.value };
      newKeys[speakerSelect.value.speaker] = [
        ...presetKeys.value[speakerSelect.value.speaker],
      ];
      newKeys[speakerSelect.value.speaker].splice(index, 1);

      store.dispatch("SAVE_PRESET_CONFIG", {
        presetItems: newItems,
        presetKeys: newKeys,
      });
    };

    return {
      updateOpenDialog,
      speakerList,
      speakerSelect,
      presetList,
      openDialogModel,
      deletePreset,
    };
  },
});
</script>
