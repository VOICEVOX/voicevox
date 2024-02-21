import { Metadata } from "@/shared/ConfigManager";

declare function vstGetConfig(): Promise<string>;
declare function vstGetProject(): Promise<string>;
declare function vstSetProject(value: string): Promise<void>;
declare function vstUpdatePhrases(
  remove: string[],
  add: unknown[]
): Promise<void>;
declare function vstClearPhrases(): Promise<void>;

type Config = Record<string, unknown> & Metadata;
const log = (message: string, ...args: unknown[]) => {
  window.electron.logInfo(`[vst/ipc] ${message}`, ...args);
};

export async function getConfig(): Promise<Config> {
  log("getConfig");
  const rawConfig = await vstGetConfig();

  return JSON.parse(rawConfig);
}

export async function getProject(): Promise<string> {
  log("getProject");
  return vstGetProject();
}

export async function setProject(memory: string) {
  log("setProject");
  await vstSetProject(memory);
}

export async function updatePhrases(remove: string[], add: unknown[]) {
  log(`updatePhrases, remove: ${remove.length}, add: ${add.length}`);
  await vstUpdatePhrases(remove, add);
}

export async function clearPhrases() {
  log("clearPhrases");
  await vstClearPhrases();
}
