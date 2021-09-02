import { Operation } from "rfc6902";
import { AudioQuery } from "@/openapi";
import { CharacterInfo, Encoding } from "@/type/preload";

export interface ICommand<S> {
  undoOperations: Operation[];
  redoOperations: Operation[];
}

export type State = {
  engineState: EngineState;
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
  isSettingDialogOpen: boolean;
  fileEncoding: Encoding;
  isMaximized: boolean;
  projectFilePath?: string;
  simpleMode: SimpleMode;
  isPinned: boolean;
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

export type EngineState = "STARTING" | "FAILED_STARTING" | "ERROR" | "READY";

export type SimpleMode = {
  enabled: boolean;
  avoid: boolean;
  dir: string;
};
