<template>
  <q-dialog v-model="modelValueComputed">
    <q-card class="q-py-sm q-px-md">
      <q-card-section class="q-pb-sm" align="center">
        <div class="text-h6">
          <q-icon name="info" color="primary" />アップデート通知
        </div>
      </q-card-section>
      <q-card-section class="q-pt-sm" align="center">
        <div class="text-body1">
          最新バージョン {{ props.latestVersion }} が利用可能です。<br />
          公式サイトから最新バージョンをダウンロードできます。
        </div>
      </q-card-section>
      <q-card-section class="q-py-none scrollable-area">
        <template
          v-for="(info, infoIndex) of props.newUpdateInfos"
          :key="infoIndex"
        >
          <div class="text-h6">バージョン {{ info.version }}</div>
          <ul>
            <template
              v-for="(item, descriptionIndex) of info.descriptions"
              :key="descriptionIndex"
            >
              <li>{{ item }}</li>
            </template>
          </ul>
        </template>
      </q-card-section>
      <q-card-actions class="button-area">
        <q-checkbox
          v-model="skipThisVersion"
          size="xs"
          dense
          label="このバージョンをスキップ"
        />
        <q-space />
        <q-btn
          padding="xs md"
          label="キャンセル"
          unelevated
          color="surface"
          text-color="display"
          class="q-mt-sm"
          @click="
            setSkipVersion();
            closeUpdateNotificationDialog();
          "
        />
        <q-btn
          padding="xs md"
          label="公式サイトを開く"
          unelevated
          color="primary"
          text-color="display-on-primary"
          class="q-mt-sm"
          @click="
            openOfficialWebsite();
            closeUpdateNotificationDialog();
          "
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { UpdateInfo } from "@/type/preload";

const props =
  defineProps<{
    modelValue: boolean;
    latestVersion: string;
    newUpdateInfos: UpdateInfo[];
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", value: boolean): void;
  }>();

const skipThisVersion = ref<boolean>(false);

const setSkipVersion = () => {
  if (skipThisVersion.value) {
    window.electron.setSetting("skipUpdateVersion", props.latestVersion);
  }
};

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const closeUpdateNotificationDialog = () => {
  modelValueComputed.value = false;
};

const openOfficialWebsite = () => {
  window.open(import.meta.env.VITE_OFFICIAL_WEBSITE_URL, "_blank");
};
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.scrollable-area {
  overflow-y: auto;
  max-height: 250px;
}

.scrollable-area h5 {
  margin: 10px 0;
}

.scrollable-area h6 {
  margin: 15px 0;
}

.button-area {
  border-top: 1px solid colors.$splitter;
  /* ボタン領域の上部に線を引く */
}
</style>
