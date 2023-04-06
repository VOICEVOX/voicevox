import { SandboxKey } from "../type/preload";
import { api } from "./sandbox";

// @ts-expect-error readonlyになっているが、初期化処理はここで行うので問題ない
window[SandboxKey] = api;
