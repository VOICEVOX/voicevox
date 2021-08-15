import { createUILockAction } from "../ui";
import { ActionTree } from "vuex";

import { State, AudioItem } from "../type";
import {
  version as version_0_3_0,
  validater as validater_0_3_0,
  ProjectType as ProjectType_0_3_0,
} from "./version0.3.0";

import { REGISTER_AUDIO_ITEM, REMOVE_ALL_AUDIO_ITEM } from "../audio";

export const LOAD_PROJECT_FILE = "LOAD_PROJECT_FILE";
export const SAVE_PROJECT_FILE = "SAVE_PROJECT_FILE";

export interface ProjectBaseType {
  appVersion: string;
}

type VersionType = [number, number, number];
type IsExact<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
function typeAssert<T extends true | false>(expectTrue: T) {
  return expectTrue;
}

interface ProjectType {
  appVersion: string;
  audioKeys: string[];
  audioItems: Record<string, AudioItem>;
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

        const chain = new ControllerChain<ProjectType_0_3_0, false>(
          obj,
          appVersionList,
          validater_0_3_0,
          version_0_3_0,
          false
        )
          .minVersion(version_0_3_0)
          // .updateVersion(version_0_x_x, updater_0_x_x, validater_0_x_x)
          // .updateVersion(version_1_y_y, updater_1_y_y, validater_1_y_y)
          .maxVersion(nowAppVersionList)
          .validate();

        if (chain.collectable == false) {
          throw new Error(chain.message());
        }

        const projectData = chain.collectObj();
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

/**
 * @name Controller
 * @summary Manipulate obj in response to the version information entered.
 * @template S Collectable obj type.
 * @template F Flag whether the obj is collectible or not
 * @example
 * ```typescript
 * const controller = new ControllerChain(
 *   obj,
 *   appVersion,
 *   validate0,
 *   version0,
 *   false
 * )
 *   .minVersion(version0)
 *   .updateVersion(version1, updater1, validater1)
 *   .updateVersion(version2, updater2, validater2)
 *   .maxVersion(latestAppVersion)
 *   .validate()
 *
 * if(controller.collectable){
 *    console.log(controller.collectObj());
 * }
 * ```
 */
interface Controller<S extends ProjectBaseType, F extends boolean> {
  /**
   * The variable for determining the type of generics.
   * F indicates whether the obj is collectible.
   * @memberof Controller
   * @type F
   */
  collectable: F;

  /**
   * Update the object if it is older than the specified version
   * Check the format of the current object before updating, and return a
   * failure value if the format is invalid.
   * @memberof Controller
   * @param version The appVersion with updated project format
   * @param updater Functions for compatibility with the previous format
   * @param validater Validation checker for project
   * @returns Return the next controller. If the object was in an invalid
   * format, return FailedControllerChain.
   */
  updateVersion: <T extends ProjectBaseType>(
    version: VersionType,
    updater: (obj: S) => ProjectBaseType,
    validater: (obj: ProjectBaseType) => obj is T
  ) => Controller<T, false>;

  /**
   * Set the upper limits of the version.
   * @memberof Controller
   * @param maxVersion Allowed maximum version
   * @returns If project version is lower than maxVersion, return FailedChain
   */
  maxVersion: (
    maxVersion: VersionType
  ) => Controller<S, F> | Controller<S, false>;

  /**
   * Set the lower limits of the version.
   * @memberof Controller
   * @param minVersion Allowed minimum version
   * @returns If project version is higher than maxVersion, return FailedChain
   */
  minVersion: (
    minVersion: VersionType
  ) => Controller<S, F> | Controller<S, false>;

  /**
   * Validate and make the obj collectible.
   * @memberof Controller
   * @returns A controller that can collect obj. If the obj is in the invalid
   * format, return Failded Chain.
   */
  validate: () => Controller<S, true> | Controller<S, false>;

  /**
   * Collect obj as specific ProjectType. If the obj is not collectable,
   * return {}.
   * @memberof Controller
   * @returns If F is true, it returns an obj as ProjectType, otherwise
   * return {}.
   */
  collectObj: () => F extends true ? S : Record<string, never>;
}

class ControllerChain<S extends ProjectBaseType, F extends boolean>
  implements Controller<S, F>
{
  private _obj: ProjectBaseType;
  private _dataVersion: VersionType;
  private _validater: (obj: ProjectBaseType) => obj is S;
  private _validateVersion: VersionType;
  private _validated: F;
  public collectable: F;

  constructor(
    obj: ProjectBaseType,
    dataVersion: VersionType,
    validater: (obj: ProjectBaseType) => obj is S,
    validateVersion: VersionType,
    validated: F
  ) {
    this._obj = obj;
    this._dataVersion = dataVersion;
    this._validater = validater;
    this._validateVersion = validateVersion;
    this._validated = validated;
    this.collectable = validated;
  }

  updateVersion<T extends ProjectBaseType>(
    version: VersionType,
    updater: (obj: S) => ProjectBaseType,
    validater: (obj: ProjectBaseType) => obj is T
  ): ControllerChain<T, false> | FailedControllerChain<T> {
    if (this._dataVersion < version) {
      const obj = this._obj;
      if (!this._validater(obj)) {
        return new FailedControllerChain<T>("Invalid project format");
      }
      return new ControllerChain<T, false>(
        updater(obj),
        this._dataVersion,
        validater,
        version,
        false
      );
    } else {
      return new ControllerChain<T, false>(
        this._obj,
        this._dataVersion,
        validater,
        version,
        false
      );
    }
  }

  minVersion(minVersion: VersionType) {
    if (this._dataVersion < minVersion) {
      return new FailedControllerChain<S>(
        `The appVersion should be ${minVersion.join(".")} or higher.`
      );
    }
    return this;
  }

  maxVersion(maxVersion: VersionType) {
    if (this._dataVersion > maxVersion) {
      return new FailedControllerChain<S>(
        `The appVersion should be ${maxVersion.join(".")} or lower.`
      );
    }
    return this;
  }

  validate(): ControllerChain<S, true> | FailedControllerChain<S> {
    if (this._validater(this._obj)) {
      return new ControllerChain<S, true>(
        this._obj,
        this._dataVersion,
        this._validater,
        this._validateVersion,
        true
      );
    } else {
      return new FailedControllerChain<S>("Invalid project format");
    }
  }

  collectObj = (): F extends true ? S : Record<string, never> => {
    if (this._validated)
      return this._obj as F extends true ? S : Record<string, never>;
    return {} as F extends true ? S : Record<string, never>;
  };
}

class FailedControllerChain<S extends ProjectBaseType>
  implements Controller<S, false>
{
  private _message: string;
  public collectable: false;

  constructor(message: string) {
    this._message = message;
    this.collectable = false;
  }

  updateVersion<T extends ProjectBaseType>(
    version: VersionType,
    updater: (obj: S) => ProjectBaseType,
    validater: (obj: ProjectBaseType) => obj is T
  ): FailedControllerChain<T> {
    return new FailedControllerChain<T>(this._message);
  }

  minVersion(): FailedControllerChain<S> {
    return this;
  }

  maxVersion(): FailedControllerChain<S> {
    return this;
  }

  validate(): FailedControllerChain<S> {
    return this;
  }

  collectObj = () => {
    return {};
  };

  /**
   * @memberof FailedControllerChain
   * @returns Return error message.
   * @example
   * ```typescript
   * const res = x.validate();
   * if(res.collectable == false){
   *   console.error(res.message());
   * }
   * ```
   */
  message() {
    return this._message;
  }
}
