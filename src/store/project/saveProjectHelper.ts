import type { ActionContext } from "../type";
import { showErrorDialog } from "@/components/Dialog/Dialog";
import { getAppInfos } from "@/domain/appInfo";
import type { LatestProjectType } from "@/infrastructures/projectFile/type";
import { DisplayableError } from "@/helpers/errorHelper";
import { ResultError } from "@/type/result";
import { toProjectFileTrack } from "@/infrastructures/projectFile/conversion";

export async function promptProjectSaveFilePath(
  context: ActionContext,
): Promise<string | undefined> {
  const defaultPath = `${context.getters.DEFAULT_PROJECT_FILE_BASE_NAME}.vvproj`;

  return await window.backend.showSaveFileDialog({
    title: "プロジェクトファイルの保存",
    name: "VOICEVOX Project file",
    extensions: ["vvproj"],
    defaultPath,
  });
}

/**
 * @throws ファイルの保存に失敗した場合
 */
export async function writeProjectFile(
  context: ActionContext,
  filePath: string,
) {
  const appVersion = getAppInfos().version;
  const {
    audioItems,
    audioKeys,
    tpqn,
    tempos,
    timeSignatures,
    tracks,
    trackOrder,
  } = context.state;
  const projectData: LatestProjectType = {
    appVersion,
    talk: {
      audioKeys,
      audioItems,
    },
    song: {
      tpqn,
      tempos,
      timeSignatures,
      tracks: Object.fromEntries(
        [...tracks.entries()].map(([trackId, track]) => {
          const projectFileTrack = toProjectFileTrack(track);
          return [trackId, projectFileTrack];
        }),
      ),
      trackOrder,
    },
  };

  const buf = new TextEncoder().encode(JSON.stringify(projectData)).buffer;
  const result = await window.backend.writeFile({
    filePath,
    buffer: new Uint8Array(buf),
  });
  if (!result.ok) {
    throw new DisplayableError("ファイルの保存に失敗しました。", {
      cause: new ResultError(result),
    });
  }
}

export async function executeWritePromiseOrDialog(
  savePromise: Promise<void>,
): Promise<boolean> {
  try {
    await savePromise;
    return true;
  } catch (e) {
    window.backend.logError(e);
    await showErrorDialog("プロジェクトファイルの保存に失敗しました", e);
    return false;
  }
}

export async function markCurrentProjectAsSaved(
  context: ActionContext,
  filePath: string,
) {
  await context.actions.APPEND_RECENTLY_USED_PROJECT({
    filePath,
  });
  context.mutations.SET_SAVED_LAST_COMMAND_IDS(
    context.getters.LAST_COMMAND_IDS,
  );
}
