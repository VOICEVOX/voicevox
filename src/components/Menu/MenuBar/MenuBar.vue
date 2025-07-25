<template>
  <QBar class="bg-background q-pa-none relative-position">
    <div
      v-if="$q.platform.is.mac && !isFullscreen"
      class="mac-traffic-light-space"
    ></div>
    <img v-else src="/icon.png" class="window-logo" alt="application logo" />
    <div class="no-margin row col no-wrap items-center">
      <div
        ref="button-container"
        class="button-container row no-wrap items-center overflow-hidden"
      >
        <div class="row other-menu-target-0"></div>
        <div
          v-for="(root, index) of menudata"
          :key="index"
          v-intersection="intersection"
          :data-index="index"
          :class="[
            { invisible: isHidden[index] },
            `other-menu-target-${index + 1}`,
          ]"
          class="row no-wrap"
        >
          <MenuButton
            v-model:selected="subMenuOpenFlags[index]"
            style="flex: none"
            :menudata="root"
            :disable="
              menubarLocked ||
              (root.disableWhenUiLocked && uiLocked) ||
              root.disabled
            "
            @mouseover="reassignSubMenuOpen(index)"
            @mouseleave="
              root.type === 'button'
                ? (subMenuOpenFlags[index] = false)
                : undefined
            "
          />
        </div>
        <Teleport v-if="isHidden.some((v) => v)" defer :to="otherMenuTo">
          <MenuButton
            v-model:selected="otherMenuOpen"
            aria-label="その他"
            :icon="isHidden.every((v) => v) ? 'menu' : 'more_horiz'"
            style="flex: none"
            :menudata="otherMenudata"
            :disable="
              menubarLocked ||
              (otherMenudata.disableWhenUiLocked && uiLocked) ||
              otherMenudata.disabled
            "
            @mouseover="reassignOtherMenuOpen"
        /></Teleport>
      </div>
      <div
        class="window-title"
        :class="{ 'text-warning': isMultiEngineOffMode }"
      >
        {{ titleText }}
      </div>
    </div>
    <div class="no-margin row items-center no-wrap">
      <TitleBarEditorSwitcher />
      <TitleBarButtons />
    </div>
  </QBar>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { IntersectionValue, useQuasar } from "quasar";
import { MenuItemButton, MenuItemData, MenuItemRoot } from "../type";
import MenuButton from "../MenuButton.vue";
import { MenuBarCategory } from "./menuBarData";
import TitleBarButtons from "./TitleBarButtons.vue";
import TitleBarEditorSwitcher from "./TitleBarEditorSwitcher.vue";
import { useStore } from "@/store";
import { getAppInfos } from "@/domain/appInfo";

const props = defineProps<{
  /** メニューバーの全サブメニューデータ */
  subMenuData: Record<MenuBarCategory, MenuItemData[]>;
  /** エディタの種類 */
  editor: "talk" | "song";
}>();

const $q = useQuasar();
const store = useStore();

/** 追加のバージョン情報。コミットハッシュなどを書ける。 */
const extraVersionInfo = import.meta.env.VITE_EXTRA_VERSION_INFO;

// デフォルトエンジンの代替先ポート
const defaultEngineAltPortTo = computed<string | undefined>(() => {
  const altPortInfos = store.state.altPortInfos;

  // ref: https://github.com/VOICEVOX/voicevox/blob/32940eab36f4f729dd0390dca98f18656240d60d/src/views/EditorHome.vue#L522-L528
  const defaultEngineInfo = Object.values(store.state.engineInfos).find(
    (engine) => engine.isDefault,
  );
  if (defaultEngineInfo == undefined) return undefined;

  // <defaultEngineId>: { from: number, to: number } -> to (代替先ポート)
  if (defaultEngineInfo.uuid in altPortInfos) {
    return altPortInfos[defaultEngineInfo.uuid];
  } else {
    return undefined;
  }
});

const isMultiEngineOffMode = computed(() => store.state.isMultiEngineOffMode);
const uiLocked = computed(() => store.getters.UI_LOCKED);
const menubarLocked = computed(() => store.getters.MENUBAR_LOCKED);
const projectName = computed(() => store.getters.PROJECT_NAME);
const isEdited = computed(() => store.getters.IS_EDITED);
const isFullscreen = computed(() => store.getters.IS_FULLSCREEN);
const titleText = computed(
  () =>
    (isEdited.value ? "*" : "") +
    (projectName.value != undefined ? projectName.value + " - " : "") +
    "VOICEVOX" +
    (" - Ver. " + getAppInfos().version) +
    (extraVersionInfo ? ` (${extraVersionInfo})` : "") +
    (isMultiEngineOffMode.value ? " - マルチエンジンオフ" : "") +
    (defaultEngineAltPortTo.value != null
      ? ` - Port: ${defaultEngineAltPortTo.value}`
      : ""),
);

// FIXME: App.vue内に移動する
watch(titleText, (newTitle) => {
  window.document.title = newTitle;
});

const menudata = computed<(MenuItemButton | MenuItemRoot)[]>(() => [
  {
    type: "root",
    label: "ファイル",
    subMenu: props.subMenuData.file,
    disabled: props.subMenuData.file.length === 0,
    disableWhenUiLocked: false,
  },
  {
    type: "root",
    label: "編集",
    subMenu: props.subMenuData.edit,
    disabled: props.subMenuData.edit.length === 0,
    disableWhenUiLocked: false,
  },
  {
    type: "root",
    label: "表示",
    subMenu: props.subMenuData.view,
    disabled: props.subMenuData.view.length === 0,
    disableWhenUiLocked: false,
  },
  {
    type: "root",
    label: "エンジン",
    subMenu: props.subMenuData.engine,
    disabled: props.subMenuData.engine.length === 0,
    disableWhenUiLocked: false,
  },
  {
    type: "root",
    label: "設定",
    subMenu: props.subMenuData.setting,
    disabled: props.subMenuData.setting.length === 0,
    disableWhenUiLocked: false,
  },
  {
    type: "button",
    label: "ヘルプ",
    onClick: () => {
      void store.actions.SET_DIALOG_OPEN({
        isHelpDialogOpen: true,
      });
    },
    disableWhenUiLocked: false,
  },
]);

// メニュー一覧
const subMenuOpenFlags = ref(
  [...Array(menudata.value.length)].map(() => false),
);

const reassignSubMenuOpen = (idx: number) => {
  if (subMenuOpenFlags.value[idx]) return;
  if (otherMenuOpen.value || subMenuOpenFlags.value.find((x) => x)) {
    otherMenuOpen.value = false;
    const arr = [...Array(menudata.value.length)].map(() => false);
    arr[idx] = true;
    subMenuOpenFlags.value = arr;
  }
};

watch(uiLocked, () => {
  // UIのロックが解除された時に再びメニューが開かれてしまうのを防ぐ
  if (uiLocked.value) {
    subMenuOpenFlags.value = [...Array(menudata.value.length)].map(() => false);
  }
});

// 省略されたメニューの処理
const isHidden = ref(menudata.value.map(() => false));
const otherMenuOpen = ref(false);
const otherMenudata = computed<MenuItemRoot>(() => {
  return {
    type: "root",
    disableWhenUiLocked: false,
    subMenu: menudata.value.filter((_, i) => isHidden.value[i]),
  };
});
const otherMenuTo = computed(() => {
  const i = isHidden.value.findIndex((v) => v);
  return `.other-menu-target-${i}`;
});
const buttonContainer = useTemplateRef("button-container");
const intersection: IntersectionValue = {
  handler(entry) {
    const element = entry?.target;
    if (entry == undefined || !(element instanceof HTMLElement)) {
      throw new Error("element is not HTMLElement");
    }
    if (element.dataset.index == undefined) {
      throw new Error("Menu button element missing required data-index attribute");
    }
    isHidden.value[parseInt(element.dataset.index)] = !entry.isIntersecting;
    return true;
  },
  cfg: {
    root: buttonContainer.value ?? undefined,
    threshold: [1],
  },
};
const reassignOtherMenuOpen = () => {
  if (subMenuOpenFlags.value.some((v) => v)) {
    subMenuOpenFlags.value.fill(false);
    otherMenuOpen.value = true;
  }
};
watch(
  isHidden,
  (isHidden) => {
    isHidden.forEach((v, i) => {
      if (v) {
        subMenuOpenFlags.value[i] = false; // 省略されたメニューは閉じる
      }
    });
    // 省略されたメニューの内容が変化したときは常に閉じる
    otherMenuOpen.value = false;
  },
  { deep: true },
);
</script>

<style lang="scss">
@use "@/styles/colors" as colors;

.active-menu {
  background-color: rgba(colors.$primary-rgb, 0.3) !important;
}
</style>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.q-bar {
  min-height: vars.$menubar-height;
  -webkit-app-region: drag; // Electronのドラッグ領域
  :deep(.q-btn) {
    -webkit-app-region: no-drag; // Electronのドラッグ領域対象から外す
  }
}

.window-logo {
  height: vars.$menubar-height;
}

.button-container {
  flex: none;
  max-width: 50%;
}

.window-title {
  flex: 1 max-content;
  height: vars.$menubar-height;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  -webkit-app-region: drag;
}

.mac-traffic-light-space {
  margin-right: 70px;
}
</style>
