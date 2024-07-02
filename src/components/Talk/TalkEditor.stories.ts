import { userEvent, within, expect, fn } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import { provide, toRaw } from "vue";
import TalkEditor from "./TalkEditor.vue";
import { createStoreWrapper, storeKey } from "@/store";
import { HotkeyManager, hotkeyManagerKey } from "@/plugins/hotkeyPlugin";
import { StoreType } from "@/store/type";
import {
  assetsPath,
  createOpenAPIEngineMock,
  mockHost,
} from "@/storybook/engineMock";
import { proxyStoreCreator } from "@/store/proxy";
import { CharacterInfo, EngineId, SpeakerId, StyleId } from "@/type/preload";
import { getEngineManifestMock } from "@/storybook/engineMock/manifestMock";
import {
  getSpeakerInfoMock,
  getSpeakersMock,
} from "@/storybook/engineMock/speakerResourceMock";

const meta: Meta<typeof TalkEditor> = {
  component: TalkEditor,
  args: {
    isEnginesReady: true,
    isProjectFileLoaded: false,
  },
  decorators: [
    (story, context) => {
      const hotkeyManager = new HotkeyManager();
      provide(hotkeyManagerKey, hotkeyManager);

      const store = createStoreWrapper({
        proxyStoreDI: proxyStoreCreator(createOpenAPIEngineMock()),
      });
      store.dispatch("HYDRATE_SETTING_STORE"); // FIXME: 色設定取得のため。設定も読み込んでしまうため不要にしたい。

      // context.parameters.store = store;

      const engineManifest = getEngineManifestMock();
      const engineId = EngineId(engineManifest.uuid);

      // setup store
      const speakers = getSpeakersMock();
      const characterInfos: CharacterInfo[] = speakers.map((speaker) => {
        const speakerInfo = getSpeakerInfoMock(speaker.speakerUuid, assetsPath);
        return {
          portraitPath: speakerInfo.portrait,
          metas: {
            speakerUuid: SpeakerId(speaker.speakerUuid),
            speakerName: speaker.name,
            styles: speakerInfo.styleInfos.map((styleInfo) => {
              const style = speaker.styles.find((s) => s.id === styleInfo.id);
              if (style == undefined) throw new Error("style not found");
              return {
                styleName: style.name,
                styleId: StyleId(style.id),
                styleType: style.type,
                iconPath: styleInfo.icon,
                portraitPath: styleInfo.portrait ?? speakerInfo.portrait,
                engineId,
                voiceSamplePaths: styleInfo.voiceSamples,
              };
            }),
            policy: speakerInfo.policy,
          },
        };
      });

      store.replaceState({
        ...structuredClone(toRaw(store.state)),
        engineIds: [engineId],
        engineStates: {
          [engineId]: "READY",
        },
        engineInfos: {
          [engineId]: {
            uuid: engineId,
            host: mockHost,
            name: engineManifest.name,
            path: undefined,
            executionEnabled: false,
            executionFilePath: "not_found",
            executionArgs: [],
            type: "default",
          },
        },
        engineManifests: {
          [engineId]: engineManifest,
        },
        characterInfos: { [engineId]: characterInfos },
        defaultStyleIds: speakers.map((speaker) => ({
          engineId: engineId,
          speakerUuid: SpeakerId(speaker.speakerUuid),
          defaultStyleId: StyleId(speaker.styles[0].id),
        })),
      });

      provide(storeKey, store);

      return story();
    },
  ],
  beforeEach: async ({ parameters }) => {
    // const store = parameters.store; // TODO: 型を付けたい
    // await store.dispatch("LOAD_CHARACTER", { engineId: EngineId(mockHost) });
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "デフォルト",
};

export const NowLoading: Story = {
  name: "プロジェクトファイルを読み込み中",
  args: {
    isProjectFileLoaded: "waiting",
  },
};
