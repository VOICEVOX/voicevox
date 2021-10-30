<template>
  <q-dialog :model-value="openDialog" @update:model-value="updateOpenDialog">
    <q-card class="setting-card q-pa-md dialogCard">
      <q-card-section>
        <div class="text-h5">プリセット管理</div>
      </q-card-section>
      <q-card-actions class="q-px-md q-py-sm">
        <div class="full-width row wrap justify-between">
          <q-select
            :options="speakerList"
            v-model="speakerSelect"
            class="col-sm-5 q-pr-sm q-pb-sm"
            label="キャラクター"
          />

          <q-list
            bordered
            separator
            class="col-sm-grow"
            v-if="presetList !== undefined"
          >
            <q-item v-for="(item, index) in presetList" :key="item.name">
              <q-item-section>{{ item.name }}</q-item-section>
              <q-space />
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
          <q-list v-else class="col-md-grow">
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
import { defineComponent, computed, ref } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "PresetManageDialog",

  props: {
    openDialog: Boolean,
  },

  emits: ["update:openDialog"],

  setup(props, context) {
    const updateOpenDialog = (e: boolean) =>
      context.emit("update:openDialog", e);

    const store = useStore();

    const presetItems = computed(() => store.state.presetItems);
    const presetKeys = computed(() => store.state.presetKeys);

    const speakerList = computed(() =>
      store.state.characterInfos
        ?.map(({ metas }) =>
          metas.styles.map((e) => {
            const label = e.styleName
              ? `${metas.speakerName}（${e.styleName}）`
              : metas.speakerName;
            return {
              label,
              speaker: e.styleId,
            };
          })
        )
        .flat()
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

      const itemsClone = { ...presetItems.value };
      delete itemsClone[key];

      const keysClone = { ...presetKeys.value };
      keysClone[speakerSelect.value.speaker] = [
        ...presetKeys.value[speakerSelect.value.speaker],
      ];
      keysClone[speakerSelect.value.speaker].splice(index, 1);

      store.dispatch("SAVE_PRESET_CONFIG", {
        presetItems: itemsClone,
        presetKeys: keysClone,
      });
    };

    return {
      updateOpenDialog,
      speakerList,
      speakerSelect,
      presetList,
      deletePreset,
    };
  },
});
</script>

<style>
.dialogCard {
  width: 700px;
  max-width: 80vw;
}
</style>
