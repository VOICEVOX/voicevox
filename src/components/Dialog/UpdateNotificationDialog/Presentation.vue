<template>
  <QDialog v-model="dialogOpened">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">{{ props.title }}</div>
        <div class="text-body2 text-grey-8">
          {{ props.description }}
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
          :label="props.updateButtonLabel"
          unelevated
          color="primary"
          textColor="display-on-primary"
          class="q-mt-sm"
          @click="
            emit('updateClick');
            closeUpdateNotificationDialog();
          "
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import type { UpdateInfo } from "@/type/preload";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });
const props = defineProps<{
  /** ダイアログのタイトル */
  title: string;
  /** ダイアログの説明 */
  description: string;
  /** アップデートボタンのラベル */
  updateButtonLabel: string;
  /** 公開されている最新のバージョン */
  latestVersion: string;
  /** 表示するアップデート情報 */
  newUpdateInfos: UpdateInfo[];
}>();
const emit = defineEmits<{
  /** スキップするときに呼ばれる */
  (e: "skipThisVersionClick", version: string): void;
  /** アップデートするときに呼ばれる */
  (e: "updateClick"): void;
}>();

const closeUpdateNotificationDialog = () => {
  dialogOpened.value = false;
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
