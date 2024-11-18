import * as windowsPath from "@std/path/windows";
import * as posixPath from "@std/path/posix";
import { isWindows } from "./platform";

const path = isWindows ? windowsPath : posixPath;

export default path;
