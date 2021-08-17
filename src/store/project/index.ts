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
          [ProjectType_0_3_0]
        >(version_0_3_0, validater_0_3_0, null, null).update<ProjectType_0_4_0>(
          version_0_4_0,
          updater_0_4_0,
          validater_0_4_0
        );

        const projectData: ProjectType_0_4_0 | null = pipe.flow(
          obj,
          appVersionList
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

class PipeChain<V, B, T extends B[]> {
  private _version: V;
  private _validater: T["length"] extends 0 ? never : (obj: B) => obj is T[0];
  private _child: T extends [unknown, ...infer U]
    ? U["length"] extends 0
      ? null
      : U extends B[]
      ? PipeChain<V, B, U>
      : never
    : never;
  private _updater: T extends [unknown, infer U, ...unknown[]]
    ? (obj: U) => B
    : null;

  constructor(
    version: V,
    validater: PipeChain<V, B, T>["_validater"],
    child: PipeChain<V, B, T>["_child"],
    updater: PipeChain<V, B, T>["_updater"]
  ) {
    this._version = version;

    this._validater = validater;
    this._child = child;
    this._updater = updater;
  }

  public f(): T {
    return null as unknown as T;
  }

  public update<N extends B>(
    version: V,
    updater: PipeChain<V, B, [N, ...T]>["_updater"],
    validater: PipeChain<V, B, [N, ...T]>["_validater"]
  ): PipeChain<V, B, [N, ...T]> {
    return new PipeChain<V, B, [N, ...T]>(
      version,
      validater,
      this as unknown as PipeChain<V, B, [N, ...T]>["_child"],
      updater
    );
  }

  public flow(obj: B, version: V): T[0] | null {
    const child = this._child;
    const updater = this._updater as ((obj: T[1]) => B) | null;
    if (version < this._version) {
      if (child instanceof PipeChain)
        if (updater != null) {
          const postObj = child.flow(obj, version) as B | null;
          if (postObj == null) {
            return null;
          }
          const updatedObj = updater(postObj);
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
