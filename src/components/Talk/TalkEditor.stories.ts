import { userEvent, within, expect, fn, waitFor } from "@storybook/test";

import { Meta, StoryObj } from "@storybook/vue3";
import { provide, toRaw } from "vue";
import TalkEditor from "./TalkEditor.vue";
import { createStoreWrapper, storeKey } from "@/store";
import { HotkeyManager, hotkeyManagerKey } from "@/plugins/hotkeyPlugin";
import {
  assetsPath,
  createOpenAPIEngineMock,
  mockHost,
} from "@/mock/engineMock";
import { proxyStoreCreator } from "@/store/proxy";
import {
  CharacterInfo,
  defaultHotkeySettings,
  DefaultStyleId,
  EngineId,
  EngineInfo,
  SpeakerId,
  StyleId,
  ThemeConf,
} from "@/type/preload";
import { getEngineManifestMock } from "@/mock/engineMock/manifestMock";
import {
  getSpeakerInfoMock,
  getSpeakersMock,
} from "@/mock/engineMock/speakerResourceMock";
import { setFont, themeToCss } from "@/domain/dom";
import defaultTheme from "@/../public/themes/default.json";

const meta: Meta<typeof TalkEditor> = {
  component: TalkEditor,
  args: {
    isEnginesReady: true,
    isProjectFileLoaded: false,
    onCompleteInitialStartup: fn(),
  },
  decorators: [
    (story, context) => {
      // CSS関連
      themeToCss(defaultTheme as ThemeConf);
      setFont("default");

      // ショートカットキーの管理
      const hotkeyManager = new HotkeyManager();
      provide(hotkeyManagerKey, hotkeyManager);
      hotkeyManager.load(defaultHotkeySettings);

      hotkeyManager.onEditorChange("talk");

      // setup store
      const store = createStoreWrapper({
        proxyStoreDI: proxyStoreCreator(createOpenAPIEngineMock()),
      });
      provide(storeKey, store);

      // なぜか必要、これがないとdispatch内でcommitしたときにエラーになる
      store.replaceState({
        ...structuredClone(toRaw(store.state)),
      });

      context.parameters.vuexState = store.state;

      // エンジンの情報
      const engineManifest = getEngineManifestMock();
      const engineId = EngineId(engineManifest.uuid);
      const engineInfo: EngineInfo = {
        uuid: engineId,
        host: mockHost,
        name: engineManifest.name,
        path: undefined,
        executionEnabled: false,
        executionFilePath: "not_found",
        executionArgs: [],
        type: "default",
      };
      store.commit("SET_ENGINE_INFOS", {
        engineIds: [engineId],
        engineInfos: [engineInfo],
      });
      store.commit("SET_ENGINE_MANIFESTS", {
        engineManifests: { [engineId]: engineManifest },
      });
      store.commit("SET_ENGINE_STATE", { engineId, engineState: "READY" });

      // キャラクター情報
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
      store.commit("SET_CHARACTER_INFOS", { engineId, characterInfos });
      store.commit("SET_USER_CHARACTER_ORDER", {
        userCharacterOrder: store.state.characterInfos[engineId].map(
          (c) => c.metas.speakerUuid,
        ),
      });

      // デフォルトスタイルID
      const defaultStyleIds: DefaultStyleId[] = speakers.map((speaker) => ({
        engineId: engineId,
        speakerUuid: SpeakerId(speaker.speakerUuid),
        defaultStyleId: StyleId(speaker.styles[0].id),
      }));
      store.commit("SET_DEFAULT_STYLE_IDS", { defaultStyleIds });

      return story();
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "デフォルト",
  play: async ({ args }) => {
    // 準備が完了するまで待機する
    await waitFor(
      () => {
        expect(args.onCompleteInitialStartup).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
  },
};

export const NowLoading: Story = {
  name: "プロジェクトファイルを読み込み中",
  args: {
    isProjectFileLoaded: "waiting",
  },
};

export const TextInput: Story = {
  name: "テキスト入力のテスト",
  play: async ({ context, canvasElement, parameters }) => {
    await Default.play?.(context);

    const canvas = within(canvasElement);

    // テキスト欄を取得
    const textInput = await canvas.findByLabelText("1行目");
    await userEvent.type(textInput, "こんにちは、これはテストです。{enter}");

    const { audioItems, audioKeys } = parameters.vuexState;
    await window.storybookTestSnapshot?.({ audioItems, audioKeys });
  },
};
