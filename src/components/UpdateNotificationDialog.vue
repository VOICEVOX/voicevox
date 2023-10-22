<template>
  <q-dialog v-if="isUpdateAvailable" v-model="showDialog">
    <q-card class="q-py-sm q-px-md">
      <q-card-section align="center">
        <div class="text-h6">
          <q-icon name="info" color="primary" />アップデート通知
        </div>
        <p>
          新しいバージョンが利用可能です。<br />
          公式サイトから最新版をダウンロードできます。
        </p>
      </q-card-section>
      <q-card-actions align="center">
        <q-btn
          padding="xs md"
          label="キャンセル"
          unelevated
          color="surface"
          text-color="display"
          class="q-mt-sm"
          @click="closeDialog()"
        />
        <q-btn
          padding="xs md"
          label="公式サイトを開く"
          unelevated
          color="primary"
          text-color="display-on-primary"
          class="q-mt-sm"
          @click="openOfficialWebsite()"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useFetchLatestVersion } from "@/composables/useFetchLatestVersion";

const { isCheckingFinished, latestVersion } = useFetchLatestVersion();

const isUpdateAvailable = computed(() => {
  return isCheckingFinished.value && latestVersion.value !== "";
});

const showDialog = ref<boolean>(true);

const closeDialog = () => {
  showDialog.value = false;
};

const openOfficialWebsite = () => {
  window.open("https://voicevox.hiroshiba.jp/", "_blank");
  closeDialog();
};
</script>
