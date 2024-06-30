<template>
  <QDialog v-model="modelValueComputed">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">アップデートのお知らせ</div>
        <div class="text-body2 text-grey-8">
          公式サイトから最新バージョンをダウンロードできます。
        </div>
      </QCardSection>

      <QSeparator />

      <QCardSection class="q-py-none scroll scrollable-area">
        <template
          v-for="(info, infoIndex) of props.newUpdateInfos"
          :key="infoIndex"
        >
          <h3>バージョン {{ info.version }}</h3>
          <ul>
            <template
              v-for="(item, descriptionIndex) of info.descriptions"
              :key="descriptionIndex"
            >
              <li>{{ item }}</li>
            </template>
          </ul>
        </template>
      </QCardSection>

      <QSeparator />

      <QCardActions>
        <QSpace />
        <QBtn
          padding="xs md"
          label="閉じる"
          unelevated
          color="surface"
          textColor="display"
          class="q-mt-sm"
          @click="closeUpdateNotificationDialog()"
        />
        <QBtn
          padding="xs md"
          label="このバージョンをスキップ"
          unelevated
          color="surface"
          textColor="display"
          class="q-mt-sm"
          @click="
            emit('skipThisVersionClick', props.latestVersion);
            closeUpdateNotificationDialog();
          "
        />
        <QBtn
          padding="xs md"
          label="公式サイトを開く"
          unelevated
          color="primary"
          textColor="display-on-primary"
          class="q-mt-sm"
          @click="
            openOfficialWebsite();
            closeUpdateNotificationDialog();
          "
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { UpdateInfo } from "@/type/preload";

const props = defineProps<{
  /** ダイアログの表示状態 */
  modelValue: boolean;
  /** 公開されている最新のバージョン */
  latestVersion: string;
  /** 表示するアップデート情報 */
  newUpdateInfos: UpdateInfo[];
}>();
const emit = defineEmits<{
  /** ダイアログの表示状態が変わるときに呼ばれる */
  (e: "update:modelValue", value: boolean): void;
  /** スキップするときに呼ばれる */
  (e: "skipThisVersionClick", version: string): void;
}>();

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
@use "@/styles/colors" as colors;

.dialog-card {
  width: 700px;
  max-width: 80vw;
}

.scrollable-area {
  overflow-y: auto;
  max-height: 50vh;

  :deep() {
    h3 {
      font-size: 1.3rem;
      font-weight: bold;
      margin: 0;
    }
  }
}
</style>
