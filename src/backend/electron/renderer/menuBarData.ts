import { computed } from "vue";
import { useEngineIcons } from "@/composables/useEngineIcons";
import {
  MaybeComputedMenuBarContent,
  MenuBarContent,
} from "@/components/Menu/MenuBar/menuBarData";
import { MenuItemData } from "@/components/Menu/type";
import { Store } from "@/store";
import { removeNullableAndBoolean } from "@/helpers/arrayHelper";

export const useElectronMenuBarData = (
  store: Store,
): MaybeComputedMenuBarContent => {
  const engineIds = computed(() => store.state.engineIds);
  const engineInfos = computed(() => store.state.engineInfos);
  const engineManifests = computed(() => store.state.engineManifests);
  const engineIcons = useEngineIcons(engineManifests);
  const enableMultiEngine = computed(() => store.state.enableMultiEngine);

  // 「エンジン」メニューのエンジン毎の項目
  const engineSubMenuData = computed<MenuBarContent["engine"]>(() => {
    let singleEngineSubMenuData: MenuItemData[];
    if (Object.values(engineInfos.value).length === 1) {
      singleEngineSubMenuData = [
        {
          type: "button",
          label: "再起動",
          onClick: () => {
            void store.actions.RESTART_ENGINES({
              engineIds: [engineIds.value[0]],
            });
          },
          disableWhenUiLocked: false,
        },
      ];
    } else {
      singleEngineSubMenuData = store.getters.GET_SORTED_ENGINE_INFOS.map(
        (engineInfo): MenuItemData => ({
          type: "root",
          label: engineInfo.name,
          icon:
            engineManifests.value[engineInfo.uuid] &&
            engineIcons.value[engineInfo.uuid],
          disableWhenUiLocked: false,
          subMenu: removeNullableAndBoolean([
            !engineInfo.isDefault && {
              type: "button",
              label: "フォルダを開く",
              onClick: () => {
                void store.actions.OPEN_ENGINE_DIRECTORY({
                  engineId: engineInfo.uuid,
                });
              },
              disableWhenUiLocked: false,
            },
            {
              type: "button",
              label: "再起動",
              onClick: () => {
                void store.actions.RESTART_ENGINES({
                  engineIds: [engineInfo.uuid],
                });
              },
              disableWhenUiLocked: false,
            },
          ]),
        }),
      );
    }

    const allEnginesSubMenuData = enableMultiEngine.value
      ? removeNullableAndBoolean<MenuItemData>([
          {
            type: "button",
            label: "全てのエンジンを再起動",
            onClick: () => {
              void store.actions.RESTART_ENGINES({
                engineIds: engineIds.value,
              });
            },
            disableWhenUiLocked: false,
          },
          {
            type: "button",
            label: "エンジンの管理",
            onClick: () => {
              void store.actions.SET_DIALOG_OPEN({
                isEngineManageDialogOpen: true,
              });
            },
            disableWhenUiLocked: false,
          },
          store.state.isMultiEngineOffMode && {
            type: "button",
            label: "マルチエンジンをオンにして再読み込み",
            onClick() {
              void store.actions.RELOAD_APP({
                isMultiEngineOffMode: false,
              });
            },
            disableWhenUiLocked: false,
            disableWhileReloadingLock: true,
          },
        ])
      : [];

    return {
      singleEngine: singleEngineSubMenuData,
      allEngines: allEnginesSubMenuData,
    };
  });

  return {
    engine: engineSubMenuData,
  };
};
