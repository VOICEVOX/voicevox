import { SandboxKey, Sandbox } from "../type/preload";
import { api } from "./sandbox";

const sandbox: Sandbox = api;
// @ts-expect-error readonlyになっているが、初期化処理はここで行うので問題ない
window[SandboxKey] = sandbox;
