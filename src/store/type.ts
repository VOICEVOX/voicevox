import { StoreOptions, MutationTree, ActionTree } from "vuex";
import { AudioQuery } from "@/openapi";
import { CharacterInfo, Encoding } from "@/type/preload";
import {
  Command,
  PayloadRecipeTree,
  PayloadMutationTree,
  createCommandMutationTree,
} from "./command";

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
  undoCommands: Command[];
  redoCommands: Command[];
  useGpu: boolean;
  isHelpDialogOpen: boolean;
  fileEncoding: Encoding;
  isMaximized: boolean;
  projectFilePath?: string;
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

export const typeAsStoreOptions = <Arg extends StoreOptions<State>>(
  arg: Arg
): Arg => arg;
export const typeAsMutationTree = <Arg extends MutationTree<State>>(
  arg: Arg
): Arg => arg;
export const typeAsActionTree = <Arg extends ActionTree<State, State>>(
  arg: Arg
): Arg => arg;

export const commandMutationsCreator = <Arg extends PayloadRecipeTree<State>>(
  arg: Arg
): PayloadMutationTree<State> => createCommandMutationTree<State, Arg>(arg);
