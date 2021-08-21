import { Operation } from "rfc6902";
import { AudioQuery } from "@/openapi";
import { CharacterInfo, Encoding } from "@/type/preload";
import { Command } from "./command";

export interface ICommand<S> {
  undoOperations: Operation[];
  redoOperations: Operation[];
}

type Command = {
  doOperation: Operation[];
  undoOperation: Operation[];
};

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
  undoCommands: Command[];
  redoCommands: Command[];
  useGpu: boolean;
  isHelpDialogOpen: boolean;
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
