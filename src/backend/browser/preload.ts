import { api } from "./sandbox.ts";
import { SandboxKey, Sandbox } from "@/type/preload.ts";

const sandbox: Sandbox = api;
// @ts-expect-error readonlyになっているが、初期化処理はここで行うので問題ない
window[SandboxKey] = sandbox;
