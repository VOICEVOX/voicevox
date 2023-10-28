<template>
  <q-dialog v-model="modelValueComputed">
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
          @click="closeUpdateNotificationDialog()"
        />
        <q-btn
          padding="xs md"
          label="詳細"
          unelevated
          color="primary"
          text-color="display-on-primary"
          class="q-mt-sm"
          @click="openUpdateInfoDialog()"
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

  <q-dialog
    no-esc-dismiss
    no-shake
    transition-show="none"
    transition-hide="none"
    :model-value="showUpdateInfoDialog"
    @update:model-value="closeUpdateInfoDialog"
  >
    <q-card class="q-py-none q-px-md">
      <!-- 新バージョンのアップデート情報を表示 -->
      <q-card-section class="q-py-sm q-px-md">
        <div class="scrollable-area">
          <h5>更新情報</h5>
          <template
            v-for="(info, infoIndex) of latestUpdateInfos"
            :key="infoIndex"
          >
            <div v-if="semver.lt(currentVersion, info.version)">
              <h6>バージョン {{ info.version }}</h6>
              <ul>
                <template
                  v-for="(item, descriptionIndex) of info.descriptions"
                  :key="descriptionIndex"
                >
                  <li>{{ item }}</li>
                </template>
              </ul>
            </div>
          </template>
        </div>
      </q-card-section>
      <q-card-section class="q-py-none q-px-md">
        <q-card-actions align="center" class="button-area">
          <q-btn
            padding="xs md"
            label="閉じる"
            unelevated
            color="surface"
            text-color="display"
            class="q-my-xs"
            @click="closeUpdateInfoDialog()"
          />
        </q-card-actions>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import semver from "semver";
import { useFetchLatestUpdateInfos } from "@/composables/useFetchLatestVersion";

const props =
  defineProps<{
    modelValue: boolean;
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", value: boolean): void;
  }>();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const closeUpdateNotificationDialog = () => {
  modelValueComputed.value = false;
};

const currentVersion = ref("");

window.electron.getAppInfos().then((obj) => {
  currentVersion.value = obj.version;
});

const latestUpdateInfos = useFetchLatestUpdateInfos();

const showUpdateInfoDialog = ref<boolean>(false);

const openUpdateInfoDialog = () => {
  showUpdateInfoDialog.value = true;
};

const closeUpdateInfoDialog = () => {
  showUpdateInfoDialog.value = false;
};

const openOfficialWebsite = () => {
  window.open("https://voicevox.hiroshiba.jp/", "_blank");
};
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.scrollable-area {
  overflow-y: auto;
  height: 250px;
}
.scrollable-area h5 {
  margin: 10px 0;
}
.scrollable-area h6 {
  margin: 15px 0;
}
.button-area {
  border-top: 1px solid colors.$splitter; /* ボタン領域の上部に線を引く */
}
</style>
