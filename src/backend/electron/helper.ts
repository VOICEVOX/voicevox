import path from "node:path";
import { app } from "electron";

export function getElectronSevenZipPath(sevenZipPath: string): string {
  return path.join(path.dirname(app.getPath("exe")), sevenZipPath);
}
