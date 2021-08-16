import { Operation } from "rfc6902";
import { AudioQuery } from "@/openapi";
import { CharacterInfo } from "@/type/preload";

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
