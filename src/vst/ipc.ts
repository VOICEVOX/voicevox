import { Metadata } from "@/shared/ConfigManager";

declare function vstGetMemory(): Promise<string>;
declare function vstSetMemory(value: string): Promise<void>;

type Memory = {
  config: Record<string, unknown> & Metadata;
  project: Record<string, unknown>;
};

export async function getMemory(): Promise<Memory> {
  const rawMemory = await vstGetMemory();

  return JSON.parse(rawMemory || "{}");
}

export async function setMemory(memory: Memory) {
  const rawMemory = JSON.stringify(memory);
  console.log("setMemory", rawMemory);
  await vstSetMemory(JSON.stringify(memory));
}
