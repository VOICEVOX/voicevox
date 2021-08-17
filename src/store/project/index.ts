import { ActionTree } from "vuex";
import { createUILockAction } from "@/store/ui";
import { REGISTER_AUDIO_ITEM, REMOVE_ALL_AUDIO_ITEM } from "@/store/audio";
import { State, AudioItem } from "@/store/type";

import {
  version as version_0_3_0,
  validater as validater_0_3_0,
  ProjectType as ProjectType_0_3_0,
} from "./version0.3.0";
import {
  version as version_0_4_0,
  validater as validater_0_4_0,
  updater as updater_0_4_0,
  ProjectType as ProjectType_0_4_0,
} from "./version0.4.0";

export const LOAD_PROJECT_FILE = "LOAD_PROJECT_FILE";
export const SAVE_PROJECT_FILE = "SAVE_PROJECT_FILE";

export interface ProjectBaseType {
  appVersion: string;
}
interface ProjectType {
  appVersion: string;
  audioKeys: string[];
  audioItems: Record<string, AudioItem>;
}

export type VersionType = [number, number, number];

type IsExact<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
function typeAssert<T extends true | false>(expectTrue: T) {
  return expectTrue;
}

export const projectActions = {
  [LOAD_PROJECT_FILE]: createUILockAction(
    async (
      context,
      { filePath, confirm }: { filePath?: string; confirm?: boolean }
    ) => {
      if (!filePath) {
        // Select and load a project File.
        const ret = await window.electron.showProjectLoadDialog({
          title: "プロジェクトファイルの選択",
        });
        if (ret == undefined || ret?.length == 0) {
          return;
        }
        filePath = ret[0];
      }

      try {
        const buf = await window.electron.readFile({ filePath });
        const text = new TextDecoder("utf-8").decode(buf).trim();
        const obj = JSON.parse(text);

        if (!("appVersion" in obj && typeof obj.appVersion === "string")) {
          throw new Error(
            "The appVersion of the project file should be string"
          );
        }

        const appVersionList = versionTextParse(obj.appVersion);
        const nowAppInfo = await window.electron.getAppInfos();
        const nowAppVersionList = versionTextParse(nowAppInfo.version);
        if (appVersionList == null || nowAppVersionList == null) {
          throw new Error(
            'An invalid appVersion format. The appVersion should be in the format "%d.%d.%d'
          );
        }

        const pipe = new PipeChain<
          VersionType,
          ProjectBaseType,
          ProjectType_0_3_0
        >(version_0_3_0, validater_0_3_0, null, null).update<ProjectType_0_4_0>(
          version_0_4_0,
          updater_0_4_0,
          validater_0_4_0
        );

        const projectData: ProjectType_0_4_0 | null = pipe.flow(
          appVersionList,
          obj
        );
        if (projectData == null) {
          throw new Error("Invalid file format");
        }

        // Error when typeof projectData != ProjectType
        typeAssert<IsExact<typeof projectData, ProjectType>>(true);

        if (
          confirm !== false &&
          !(await window.electron.showConfirmDialog({
            title: "警告",
            message:
              "プロジェクトをロードすると現在のプロジェクトは破棄されます。\n" +
              "よろしいですか？",
          }))
        ) {
          return;
        }
        await context.dispatch(REMOVE_ALL_AUDIO_ITEM);

        const { audioItems, audioKeys } = projectData;

        let prevAudioKey = undefined;
        for (const audioKey of audioKeys) {
          const audioItem = audioItems[audioKey];
          prevAudioKey = await context.dispatch(REGISTER_AUDIO_ITEM, {
            prevAudioKey,
            audioItem,
          });
        }
      } catch (err) {
        console.error(err);
        console.error(`VOICEVOX Project file "${filePath}" is a invalid file.`);
        await window.electron.showErrorDialog({
          title: "エラー",
          message: "ファイルフォーマットが正しくありません。",
        });
      }
    }
  ),
  [SAVE_PROJECT_FILE]: createUILockAction(async (context) => {
    // Write the current status to a project file.
    const ret = await window.electron.showProjectSaveDialog({
      title: "プロジェクトファイルの選択",
    });
    if (ret == undefined) {
      return;
    }
    const filePath = ret;

    const appInfos = await window.electron.getAppInfos();
    const { audioItems, audioKeys } = context.state;
    const projectData: ProjectType = {
      appVersion: appInfos.version,
      audioKeys,
      audioItems,
    };
    const buf = new TextEncoder().encode(JSON.stringify(projectData)).buffer;
    window.electron.writeFile({ filePath, buffer: buf });
    return;
  }),
} as ActionTree<State, State>;

const versionTextParse = (appVersionText: string): VersionType | undefined => {
  const textArray = appVersionText.split(".");
  if (textArray.length !== 3) return undefined;
  const appVersion = textArray.map(Number) as VersionType;
  if (!appVersion.every((item) => Number.isInteger(item))) return undefined;
  return appVersion;
};

class PipeChain<VER, BASE, RET extends BASE, RES extends BASE[] = []> {
  private _version: VER;
  private _validater: (obj: BASE) => obj is RET;
  private _child: RES extends [infer T, ...infer U]
    ? T extends BASE
      ? U extends BASE[]
        ? PipeChain<VER, BASE, T, U>
        : never
      : never
    : null;
  private _updater: RES["length"] extends 0 ? null : (obj: RES[0]) => BASE;

  constructor(
    version: VER,
    validater: PipeChain<VER, BASE, RET, RES>["_validater"],
    child: PipeChain<VER, BASE, RET, RES>["_child"],
    updater: PipeChain<VER, BASE, RET, RES>["_updater"]
  ) {
    this._version = version;
    this._validater = validater;
    this._child = child;
    this._updater = updater;
  }

  public update<N extends BASE>(
    version: VER,
    updater: PipeChain<VER, BASE, N, [RET, ...RES]>["_updater"],
    validater: PipeChain<VER, BASE, N, [RET, ...RES]>["_validater"]
  ): PipeChain<VER, BASE, N, [RET, ...RES]> {
    return new PipeChain<VER, BASE, N, [RET, ...RES]>(
      version,
      validater,
      this as unknown as PipeChain<VER, BASE, N, [RET, ...RES]>["_child"],
      updater
    );
  }

  public flow(version: VER, obj: BASE): RET | null {
    const child = this._child as unknown;
    if (version < this._version) {
      if (child instanceof PipeChain)
        if (this._updater != null) {
          const postObj = child.flow(version, obj) as BASE | null;
          if (postObj == null) {
            return null;
          }
          const updatedObj = this._updater(postObj);
          if (this._validater(updatedObj)) {
            return updatedObj;
          } else {
            return null;
          }
        }
    }
    if (this._validater(obj)) {
      return obj;
    } else {
      return null;
    }
  }
}
