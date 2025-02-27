import { showAlertDialog } from "@/components/Dialog/Dialog";
import { getAppInfos } from "@/domain/appInfo";
import { LatestProjectType } from "@/domain/project/schema";
import { errorToMessage } from "@/helpers/errorHelper";
import { getValueOrThrow } from "@/type/result";
import { ActionContext } from "../type";

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

export async function writeProjectFile(
  context: ActionContext,
  filePath: string,
): Promise<boolean> {
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
      tracks: Object.fromEntries(tracks),
      trackOrder,
    },
  };

  const buf = new TextEncoder().encode(JSON.stringify(projectData)).buffer;
  try {
    await window.backend
      .writeFile({
        filePath,
        buffer: buf,
      })
      .then(getValueOrThrow);
    return true;
  } catch (err) {
    window.backend.logError(err);
    await showAlertDialog({
      title: "エラー",
      message: `プロジェクトファイルの保存に失敗しました。\n${errorToMessage(err)}`,
    });
    return false;
  }
}
