import { spawn, ChildProcess } from "child_process";
import treeKill from "tree-kill";
import Store from "electron-store";
import shlex from "shlex";

import { BrowserWindow, dialog } from "electron";

import path from "path";
import { ipcMainSend } from "@/electron/ipc";

import fs from "fs";
import {
  EngineInfo,
  ElectronStoreType,
  EngineDirValidationResult,
} from "@/type/preload";

import log from "electron-log";
import { z } from "zod";

const envSchema = z
  .object({
    uuid: z.string().uuid(),
    host: z.string(),
    name: z.string(),
    executionEnabled: z.boolean(),
    executionFilePath: z.string(),
    executionArgs: z.array(z.string()),
    path: z.string().optional(),
  })
  .array();

type MinimumEngineManifest = {
  name: string;
  uuid: string;
  command: string;
  port: string;
  icon: string;
};

type EngineProcessContainer = {
  willQuitEngine: boolean;
  engineProcess?: ChildProcess;
};

/**
 * デフォルトエンジンの情報を作成する
 */
function createDefaultEngineInfos(defaultEngineDir: string): EngineInfo[] {
  // TODO: envから直接ではなく、envに書いたengine_manifest.jsonから情報を得るようにする
  const defaultEngineInfosEnv = process.env.DEFAULT_ENGINE_INFOS ?? "[]";

  const engines = envSchema.parse(JSON.parse(defaultEngineInfosEnv));

  return engines.map((engineInfo) => {
    return {
      ...engineInfo,
      type: "default",
      path:
        engineInfo.path === undefined
          ? undefined
          : path.resolve(defaultEngineDir, engineInfo.path),
    };
  });
}

export class EngineManager {
  store: Store<ElectronStoreType>;
  defaultEngineDir: string;
  vvppEngineDir: string;

  defaultEngineInfos: EngineInfo[];
  engineProcessContainers: Record<string, EngineProcessContainer>;

  constructor({
    store,
    defaultEngineDir,
    vvppEngineDir,
  }: {
    store: Store<ElectronStoreType>;
    defaultEngineDir: string;
    vvppEngineDir: string;
  }) {
    this.store = store; // FIXME: エンジンマネージャーがelectron-storeを持たなくても良いようにする
    this.defaultEngineDir = defaultEngineDir;
    this.vvppEngineDir = vvppEngineDir;

    this.defaultEngineInfos = createDefaultEngineInfos(defaultEngineDir);
    this.engineProcessContainers = {};
  }

  /**
   * 追加エンジンの一覧を取得する。
   * FIXME: store.get("engineDirs")への副作用をEngineManager外に移動する
   */
  fetchAdditionalEngineInfos(): EngineInfo[] {
    const engines: EngineInfo[] = [];
    const addEngine = (engineDir: string, type: "vvpp" | "path") => {
      const manifestPath = path.join(engineDir, "engine_manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return "manifestNotFound";
      }
      let manifest: MinimumEngineManifest;
      try {
        manifest = JSON.parse(
          fs.readFileSync(manifestPath, { encoding: "utf8" })
        );
      } catch (e) {
        return "manifestParseError";
      }

      const [command, ...args] = shlex.split(manifest.command);

      engines.push({
        uuid: manifest.uuid,
        host: `http://127.0.0.1:${manifest.port}`,
        name: manifest.name,
        path: engineDir,
        executionEnabled: true,
        executionFilePath: path.join(engineDir, command),
        executionArgs: args,
        type,
      });
      return "ok";
    };
    for (const dirName of fs.readdirSync(this.vvppEngineDir)) {
      const engineDir = path.join(this.vvppEngineDir, dirName);
      if (!fs.statSync(engineDir).isDirectory()) {
        log.log(`${engineDir} is not directory`);
        continue;
      }
      if (dirName === ".tmp") {
        continue;
      }
      const result = addEngine(engineDir, "vvpp");
      if (result !== "ok") {
        log.log(`Failed to load engine: ${result}, ${engineDir}`);
      }
    }
    // FIXME: この関数の引数でengineDirsを受け取り、動かないエンジンをreturnして、EngineManager外でstore.setする
    for (const engineDir of this.store.get("engineDirs")) {
      const result = addEngine(engineDir, "path");
      if (result !== "ok") {
        log.log(`Failed to load engine: ${result}, ${engineDir}`);
        // 動かないエンジンは追加できないので削除
        // FIXME: エンジン管理UIで削除可能にする
        dialog.showErrorBox(
          "エンジンの読み込みに失敗しました。",
          `${engineDir}を読み込めませんでした。このエンジンは削除されます。`
        );
        this.store.set(
          "engineDirs",
          this.store.get("engineDirs").filter((p) => p !== engineDir)
        );
      }
    }
    return engines;
  }

  /**
   * 全てのエンジンの一覧を取得する。デフォルトエンジン＋追加エンジン。
   */
  fetchEngineInfos(): EngineInfo[] {
    const additionalEngineInfos = this.fetchAdditionalEngineInfos();
    return [...this.defaultEngineInfos, ...additionalEngineInfos];
  }

  /**
   * エンジンの情報を取得する。存在しない場合はエラーを返す。
   */
  fetchEngineInfo(engineId: string): EngineInfo {
    const engineInfos = this.fetchEngineInfos();
    const engineInfo = engineInfos.find(
      (engineInfo) => engineInfo.uuid === engineId
    );
    if (!engineInfo) {
      throw new Error(`No such engineInfo registered: engineId == ${engineId}`);
    }
    return engineInfo;
  }

  /**
   * エンジンのディレクトリを取得する。存在しない場合はエラーを返す。
   */
  fetchEngineDirectory(engineId: string): string {
    const engineInfo = this.fetchEngineInfo(engineId);
    const engineDirectory = engineInfo.path;
    if (engineDirectory == null) {
      throw new Error(`engineDirectory is null: engineId == ${engineId}`);
    }

    return engineDirectory;
  }

  /**
   * 全てのエンジンを起動する。
   * FIXME: winを受け取らなくても良いようにする
   */
  async runEngineAll(win: BrowserWindow) {
    const engineInfos = this.fetchEngineInfos();
    log.info(`Starting ${engineInfos.length} engine/s...`);

    for (const engineInfo of engineInfos) {
      log.info(`ENGINE ${engineInfo.uuid}: Start launching`);
      await this.runEngine(engineInfo.uuid, win);
    }
  }

  /**
   * エンジンを起動する。
   * FIXME: winを受け取らなくても良いようにする
   */
  async runEngine(engineId: string, win: BrowserWindow) {
    const engineInfos = this.fetchEngineInfos();
    const engineInfo = engineInfos.find(
      (engineInfo) => engineInfo.uuid === engineId
    );
    if (!engineInfo)
      throw new Error(`No such engineInfo registered: engineId == ${engineId}`);

    if (!engineInfo.executionEnabled) {
      log.info(`ENGINE ${engineId}: Skipped engineInfo execution: disabled`);
      return;
    }

    if (!engineInfo.executionFilePath) {
      log.info(
        `ENGINE ${engineId}: Skipped engineInfo execution: empty executionFilePath`
      );
      return;
    }

    log.info(`ENGINE ${engineId}: Starting process`);

    if (!(engineId in this.engineProcessContainers)) {
      this.engineProcessContainers[engineId] = {
        willQuitEngine: false,
      };
    }

    const engineProcessContainer = this.engineProcessContainers[engineId];
    engineProcessContainer.willQuitEngine = false;

    const useGpu = this.store.get("useGpu");

    log.info(`ENGINE ${engineId} mode: ${useGpu ? "GPU" : "CPU"}`);

    // エンジンプロセスの起動
    const enginePath = engineInfo.executionFilePath;
    const args = engineInfo.executionArgs.concat(useGpu ? ["--use_gpu"] : []);

    log.info(`ENGINE ${engineId} path: ${enginePath}`);
    log.info(`ENGINE ${engineId} args: ${JSON.stringify(args)}`);

    const engineProcess = spawn(enginePath, args, {
      cwd: path.dirname(enginePath),
    });
    engineProcessContainer.engineProcess = engineProcess;

    engineProcess.stdout?.on("data", (data) => {
      log.info(`ENGINE ${engineId} STDOUT: ${data.toString("utf-8")}`);
    });

    engineProcess.stderr?.on("data", (data) => {
      log.error(`ENGINE ${engineId} STDERR: ${data.toString("utf-8")}`);
    });

    engineProcess.on("error", (err) => {
      log.error(`ENGINE ${engineId} ERROR: ${err}`);
      // FIXME: "close"イベントでダイアログが表示されて２回表示されてしまうのを防ぐ
      // 詳細 https://github.com/VOICEVOX/voicevox/pull/1053/files#r1051436950
      dialog.showErrorBox(
        "音声合成エンジンエラー",
        `音声合成エンジンが異常終了しました。${err}`
      );
    });

    engineProcess.on("close", (code, signal) => {
      log.info(
        `ENGINE ${engineId}: Process terminated due to receipt of signal ${signal}`
      );
      log.info(`ENGINE ${engineId}: Process exited with code ${code}`);

      if (!engineProcessContainer.willQuitEngine) {
        ipcMainSend(win, "DETECTED_ENGINE_ERROR", { engineId });
        const dialogMessage =
          engineInfos.length === 1
            ? "音声合成エンジンが異常終了しました。エンジンを再起動してください。"
            : `${engineInfo.name}の音声合成エンジンが異常終了しました。エンジンを再起動してください。`;
        dialog.showErrorBox("音声合成エンジンエラー", dialogMessage);
      }
    });
  }

  /**
   * 全てのエンジンに対し、各エンジンを終了するPromiseを返す。
   */
  killEngineAll(): Record<string, Promise<void>> {
    const killingProcessPromises: Record<string, Promise<void>> = {};

    for (const engineId of Object.keys(this.engineProcessContainers)) {
      const promise = this.killEngine(engineId);
      if (promise === undefined) continue;

      killingProcessPromises[engineId] = promise;
    }

    return killingProcessPromises;
  }

  /**
   * エンジンを終了するPromiseを返す。
   * @returns
   * Promise<void> | undefined
   * Promise.resolve: エンジンプロセスのキルに成功した（非同期）
   * Promise.reject: エンジンプロセスのキルに失敗した（非同期）
   * undefined: エンジンプロセスのキルが開始されなかった＝エンジンプロセスがすでに停止している（同期）
   */
  killEngine(engineId: string): Promise<void> | undefined {
    const engineProcessContainer = this.engineProcessContainers[engineId];
    if (!engineProcessContainer) {
      log.error(`No such engineProcessContainer: engineId == ${engineId}`);

      return undefined;
    }

    const engineProcess = engineProcessContainer.engineProcess;
    if (engineProcess === undefined) {
      // nop if no process started (already killed or not started yet)
      log.info(`ENGINE ${engineId}: Process not started`);

      return undefined;
    }

    const engineNotExited = engineProcess.exitCode === null;
    const engineNotKilled = engineProcess.signalCode === null;

    log.info(
      `ENGINE ${engineId}: last exit code: ${engineProcess.exitCode}, signal: ${engineProcess.signalCode}`
    );

    const isAlive = engineNotExited && engineNotKilled;
    if (!isAlive) {
      log.info(`ENGINE ${engineId}: Process already closed`);

      return undefined;
    }

    return new Promise<void>((resolve, reject) => {
      log.info(
        `ENGINE ${engineId}: Killing process (PID=${engineProcess.pid})`
      );

      // エラーダイアログを抑制
      engineProcessContainer.willQuitEngine = true;

      // プロセス終了時のイベントハンドラ
      engineProcess.once("close", () => {
        log.info(`ENGINE ${engineId}: Process closed`);
        resolve();
      });

      try {
        engineProcess.pid != undefined && treeKill(engineProcess.pid);
      } catch (error: unknown) {
        log.error(`ENGINE ${engineId}: Error during killing process`);
        reject(error);
      }
    });
  }

  /**
   * 全てのエンジンを再起動する。
   * FIXME: winを受け取らなくても良いようにする
   */
  async restartEngineAll(win: BrowserWindow) {
    const engineInfos = this.fetchEngineInfos();
    for (const engineInfo of engineInfos) {
      await this.restartEngine(engineInfo.uuid, win);
    }
  }

  /**
   * エンジンを再起動する。
   * FIXME: winを受け取らなくても良いようにする
   */
  async restartEngine(engineId: string, win: BrowserWindow) {
    // FIXME: killEngine関数を使い回すようにする
    await new Promise<void>((resolve, reject) => {
      const engineProcessContainer: EngineProcessContainer | undefined =
        this.engineProcessContainers[engineId];
      const engineProcess = engineProcessContainer?.engineProcess;

      log.info(
        `ENGINE ${engineId}: Restarting process (last exit code: ${engineProcess?.exitCode}, signal: ${engineProcess?.signalCode})`
      );

      // エンジンのプロセスがすでに終了している、またはkillされている場合
      const engineExited = engineProcess?.exitCode !== null;
      const engineKilled = engineProcess?.signalCode !== null;

      // engineProcess === undefinedの場合true
      if (engineExited || engineKilled) {
        log.info(
          `ENGINE ${engineId}: Process is not started yet or already killed. Starting process...`
        );

        this.runEngine(engineId, win);
        resolve();
        return;
      }

      // エンジンエラー時のエラーウィンドウ抑制用。
      engineProcessContainer.willQuitEngine = true;

      // 「killに使用するコマンドが終了するタイミング」と「OSがプロセスをkillするタイミング」が違うので単純にtreeKillのコールバック関数でrunEngine()を実行すると失敗します。
      // closeイベントはexitイベントよりも後に発火します。
      const restartEngineOnProcessClosedCallback = () => {
        log.info(`ENGINE ${engineId}: Process killed. Restarting process...`);

        this.runEngine(engineId, win);
        resolve();
      };

      if (engineProcess === undefined)
        throw Error("engineProcess === undefined");

      engineProcess.once("close", restartEngineOnProcessClosedCallback);

      // treeKillのコールバック関数はコマンドが終了した時に呼ばれます。
      log.info(
        `ENGINE ${engineId}: Killing current process (PID=${engineProcess.pid})...`
      );
      treeKill(engineProcess.pid, (error) => {
        // error変数の値がundefined以外であればkillコマンドが失敗したことを意味します。
        if (error != null) {
          log.error(`ENGINE ${engineId}: Failed to kill process`);
          log.error(error);

          // killに失敗したとき、closeイベントが発生せず、once listenerが消費されない
          // listenerを削除してENGINEの意図しない再起動を防止
          engineProcess.removeListener(
            "close",
            restartEngineOnProcessClosedCallback
          );

          reject();
        }
      });
    });
  }

  /**
   * ディレクトリがエンジンとして正しいかどうかを判定する
   */
  validateEngineDir(engineDir: string): EngineDirValidationResult {
    if (!fs.existsSync(engineDir)) {
      return "directoryNotFound";
    } else if (!fs.statSync(engineDir).isDirectory()) {
      return "notADirectory";
    } else if (!fs.existsSync(path.join(engineDir, "engine_manifest.json"))) {
      return "manifestNotFound";
    }
    const manifest = fs.readFileSync(
      path.join(engineDir, "engine_manifest.json"),
      "utf-8"
    );
    let manifestContent: MinimumEngineManifest;
    try {
      manifestContent = JSON.parse(manifest);
    } catch (e) {
      return "invalidManifest";
    }

    if (
      ["name", "uuid", "port", "command", "icon"].some(
        (key) => !(key in manifestContent)
      )
    ) {
      return "invalidManifest";
    }

    const engineInfos = this.fetchEngineInfos();
    if (
      engineInfos.some((engineInfo) => engineInfo.uuid === manifestContent.uuid)
    ) {
      return "alreadyExists";
    }
    return "ok";
  }
}

export default EngineManager;
