import { Operation } from "rfc6902";
import { AudioQuery } from "@/openapi";
<<<<<<< HEAD
import { CharacterInfo } from "@/type/preload";
import { Rectangle } from "electron";
=======
import { CharacterInfo, Encoding } from "@/type/preload";
>>>>>>> 63d4bca6f9ba2f043d6ea287ff9678b5312f0d80

export interface ICommand<S> {
  undoOperations: Operation[];
  redoOperations: Operation[];
}

export type State = {
  isEngineReady: boolean;
  characterInfos?: CharacterInfo[];
  audioItems: Record<string, AudioItem>;
  audioKeys: string[];
  audioStates: Record<string, AudioState>;
  _activeAudioKey?: string;
  uiLockCount: number;
  audioDetailPaneOffset?: number;
  audioInfoPaneOffset?: number;
  nowPlayingContinuously: boolean;
  undoCommands: ICommand<State>[];
  redoCommands: ICommand<State>[];
  useGpu: boolean;
  isHelpDialogOpen: boolean;
  windowBoundsBeforeMaximize: Rectangle;
  fileEncoding: Encoding;
};

export type AudioItem = {
  text: string;
  characterIndex?: number;
  query?: AudioQuery;
};

export type AudioState = {
  nowPlaying: boolean;
  nowGenerating: boolean;
};
