import { Metadata } from "@/shared/ConfigManager";

declare function vstGetConfig(): Promise<string>;
declare function vstGetMemory(): Promise<string>;
declare function vstSetMemory(value: string): Promise<void>;
declare function vstUpdatePhrases(
  remove: string[],
  add: unknown[]
): Promise<void>;
declare function vstClearPhrases(): Promise<void>;

type Config = Record<string, unknown> & Metadata;

export async function getConfig(): Promise<Config> {
  const rawConfig = await vstGetConfig();

  return JSON.parse(rawConfig);
}

export async function getMemory(): Promise<unknown> {
  const rawMemory = await vstGetMemory();

  return JSON.parse(rawMemory);
}

export async function setMemory(memory: unknown) {
  await vstSetMemory(JSON.stringify(memory));
}

export async function updatePhrases(remove: string[], add: unknown[]) {
  await vstUpdatePhrases(remove, add);
}

export async function clearPhrases() {
  await vstClearPhrases();
}
