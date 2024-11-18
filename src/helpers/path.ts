import * as windowsPath from "@std/path/windows";
import * as posixPath from "@std/path/posix";
import { isWindows } from "./platform";

// OSにあったパス操作関数をエクスポートする。
// NOTE: @std/pathのWindows判定は差し替えられないので、ここで判定する
const path = isWindows ? windowsPath : posixPath;

export default path;
