<template>
  <q-dialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="transparent-backdrop"
    v-model="modelValueComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title class="text-display"
              >音声ライブラリのダウンロード</q-toolbar-title
            >
          </div>

          <q-space />

          <div class="row items-center no-wrap">
            <q-btn
              round
              flat
              icon="close"
              color="display"
              @click="closeDialog"
              :disable="!!installingLibrary"
            />
          </div>
        </q-toolbar>
      </q-header>

      <q-drawer
        bordered
        v-if="portraitUri"
        :model-value="true"
        :width="$q.screen.width / 3 > 300 ? 300 : $q.screen.width / 3"
        :breakpoint="0"
      >
        <div class="library-portrait-wrapper">
          <img :src="portraitUri" class="library-portrait" />
        </div>
      </q-drawer>

      <q-page-container>
        <q-page class="main">
          <div v-if="libraryInstallStatus" class="installing">
            <div>
              <q-circular-progress
                v-if="
                  libraryInstallStatus.status === 'downloading' &&
                  libraryInstallStatus.contentLength
                "
                color="primary"
                size="xl"
                :value="
                  (libraryInstallStatus.downloaded /
                    libraryInstallStatus.contentLength) *
                  100
                "
                show-value
                :thickness="0.3"
              >
                {{
                  (
                    (libraryInstallStatus.downloaded /
                      libraryInstallStatus.contentLength) *
                    100
                  ).toFixed(1)
                }}
                %
              </q-circular-progress>
              <q-circular-progress
                indeterminate
                color="primary"
                size="xl"
                v-else
                :thickness="0.3"
              />
              <div
                class="q-mt-xs"
                v-if="libraryInstallStatus.status === 'pending'"
              >
                処理中・・・
              </div>
              <div
                class="q-mt-xs"
                v-else-if="libraryInstallStatus.status === 'downloading'"
              >
                ダウンロード中・・・
              </div>
              <div
                class="q-mt-xs"
                v-else-if="libraryInstallStatus.status === 'installing'"
              >
                インストール中・・・
              </div>
            </div>
          </div>
          <div
            class="q-pa-md library-items-container"
            v-for="engineId of engineIdsWithDownloadableLibraries"
            :key="engineId"
          >
            <LDDEngineSection
              :engineId="engineId"
              v-model:installingLibrary="installingLibrary"
              v-model:portraitUri="portraitUri"
            />
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuasar } from "quasar";
import LDDEngineSection from "./LDDEngineSection.vue";
import { useStore } from "@/store";
import { LibraryInstallId } from "@/type/preload";

const $q = useQuasar();

const props =
  defineProps<{
    modelValue: boolean;
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", val: boolean): void;
  }>();

const store = useStore();

const engineIds = computed(() => store.state.engineIds);
const engineManifests = computed(() => store.state.engineManifests);
const libraryInstallStatuses = computed(
  () => store.state.libraryInstallStatuses
);

const engineIdsWithDownloadableLibraries = computed(() => {
  return engineIds.value.filter((engineId) => {
    return engineManifests.value[engineId]?.supportedFeatures?.manageLibrary;
  });
});

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const installingLibrary = ref<LibraryInstallId | undefined>(undefined);
const libraryInstallStatus = computed(() => {
  if (!installingLibrary.value) return undefined;
  return libraryInstallStatuses.value[installingLibrary.value];
});
watch(libraryInstallStatus, (val) => {
  if (val?.status === "done") {
    installingLibrary.value = undefined;
  } else if (val?.status === "error") {
    installingLibrary.value = undefined;
    $q.dialog({
      title: "エラー",
      message: val.message,
      ok: true,
    });
  }
});
const portraitUri = ref("");

const closeDialog = () => {
  stop();
  modelValueComputed.value = false;
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-toolbar div:first-child {
  min-width: 0;
}
.library-portrait-wrapper {
  display: grid;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  .library-portrait {
    margin: auto;
  }
}

.main {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width}
  );
  width: 100%;
  overflow-y: scroll;
  > div {
    width: 100%;
  }
}

.installing {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$background;
    border-radius: 6px;
    padding: 14px;
  }
}

.library-items-container {
  padding: 5px 16px;

  flex-grow: 1;

  display: flex;
  flex-direction: column;

  > div.q-circular-progress {
    margin: auto;
  }
  > div.library-list {
    $library-item-size: 215px;
    display: grid;
    grid-template-columns: repeat(auto-fit, $library-item-size);
    grid-auto-rows: 275px;
    column-gap: 10px;
    row-gap: 10px;
    align-content: center;
    justify-content: center;
    // deepをつけないとdisableになったときにUIが崩壊する
    :deep(.library-item) {
      box-shadow: 0 0 0 1px rgba(colors.$primary-light-rgb, 0.5);
      border-radius: 10px;
      overflow: hidden;
      &.selected-library-item {
        box-shadow: 0 0 0 2px colors.$primary-light;
      }
      &:hover :deep(.q-focus-helper) {
        opacity: 0 !important;
      }
      &.hoverable-library-item:hover :deep(.q-focus-helper) {
        opacity: 0.15 !important;
      }
      .library-item-inner {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        .style-icon {
          $icon-size: $library-item-size / 2;
          width: $icon-size;
          height: $icon-size;
          border-radius: 5px;
        }
        .style-select-container {
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          margin-top: -1rem;
        }
        .voice-samples {
          display: flex;
          column-gap: 5px;
          align-items: center;
          justify-content: center;
        }
        .new-library-item {
          color: colors.$primary-light;
          position: absolute;
          left: 0px;
          top: 0px;
        }
      }
    }
  }
}

.library-order-container {
  width: 180px;
  height: 100%;

  display: flex;
  flex-direction: column;

  .library-order {
    flex: 1;

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;

    overflow-y: auto;

    .library-order-item {
      border-radius: 10px;
      border: 2px solid rgba(colors.$display-rgb, 0.15);
      text-align: center;
      cursor: grab;
      &.selected-library-order-item {
        border: 2px solid colors.$primary-light;
      }
    }
  }
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

@media screen and (max-width: 880px) {
  .q-drawer-container {
    display: none;
  }
  .q-page-container {
    padding-left: unset !important;
    .q-page-sticky {
      left: 0 !important;
    }
  }
}
</style>
