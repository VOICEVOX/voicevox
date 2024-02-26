import { api } from "./sandbox";
import { SandboxKey, Sandbox } from "@/type/preload";

const sandbox: Sandbox = api;
// @ts-expect-error readonlyになっているが、初期化処理はここで行うので問題ない
window[SandboxKey] = sandbox;
