import EngineManager from "./engineManager";
import {
  EngineId,
  LibraryInstallId,
  LibraryInstallStatus,
} from "@/type/preload";
import { DownloadableLibrary } from "@/openapi";

export class LibraryManager {
  engineManager: EngineManager;

  constructor({ engineManager }: { engineManager: EngineManager }) {
    this.engineManager = engineManager;
  }

  async installLibrary(
    engineId: EngineId,
    library: DownloadableLibrary,
    libraryInstallId: LibraryInstallId,
    onUpdate: (status: LibraryInstallStatus) => void
  ): Promise<LibraryInstallStatus> {
    console.log(
      "installLibrary",
      engineId,
      library,
      libraryInstallId,
      onUpdate
    );
    throw new Error("Not implemented");
  }
}

export default LibraryManager;
