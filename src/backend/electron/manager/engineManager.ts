import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import treeKill from "tree-kill";
import shlex from "shlex";

import { app, dialog } from "electron"; // FIXME: ここでelectronをimportするのは良くない

import log from "electron-log/main";
import {
  findAltPort,
  getPidFromPort,
  getProcessNameFromPid,
  isAssignablePort,
  url2HostInfo,
} from "./portManager";

import {
  EngineInfo,
  EngineDirValidationResult,
  MinimumEngineManifestType,
  EngineId,
  minimumEngineManifestSchema,
  envEngineInfoSchema,
} from "@/type/preload";
import { AltPortInfos } from "@/store/type";
import { BaseConfigManager } from "@/backend/common/ConfigManager";

type EngineProcessContainer = {
  willQuitEngine: boolean;
  engineProcess?: ChildProcess;
};

/**
 * デフォルトエンジンの情報を作成する
 */
function createDefaultEngineInfos(defaultEngineDir: string): EngineInfo[] {
  // TODO: envから直接ではなく、envに書いたengine_manifest.jsonから情報を得るようにする
  const defaultEngineInfosEnv =
    import.meta.env.VITE_DEFAULT_ENGINE_INFOS ?? "[]";

  const envSchema = envEngineInfoSchema.array();
  const engines = envSchema.parse(JSON.parse(defaultEngineInfosEnv));

  return engines.map((engineInfo) => {
    return {
      ...engineInfo,
      type: "default",
      executionFilePath: path.resolve(engineInfo.executionFilePath),
      path:
        engineInfo.path == undefined
          ? undefined
          : path.resolve(defaultEngineDir, engineInfo.path),
    };
  });
}

export class EngineManager {
  configManager: BaseConfigManager;
  defaultEngineDir: string;
  vvppEngineDir: string;
  onEngineProcessError: (engineInfo: EngineInfo, error: Error) => void;

  defaultEngineInfos: EngineInfo[] = [];
  additionalEngineInfos: EngineInfo[] = [];
  engineProcessContainers: Record<EngineId, EngineProcessContainer>;

  public altPortInfo: AltPortInfos = {};

  constructor({
    configManager,
    defaultEngineDir,
    vvppEngineDir,
    onEngineProcessError,
  }: {
    configManager: BaseConfigManager;
    defaultEngineDir: string;
    vvppEngineDir: string;
    onEngineProcessError: (engineInfo: EngineInfo, error: Error) => void;
  }) {
    this.configManager = configManager;
    this.defaultEngineDir = defaultEngineDir;
    this.vvppEngineDir = vvppEngineDir;
    this.onEngineProcessError = onEngineProcessError;
    this.engineProcessContainers = {};
  }

  /**
   * 追加エンジンの一覧を作成する。
   * FIXME: store.get("registeredEngineDirs")への副作用をEngineManager外に移動する
   */
  private createAdditionalEngineInfos(): EngineInfo[] {
    const engines: EngineInfo[] = [];
    const addEngine = (engineDir: string, type: "vvpp" | "path") => {
      const manifestPath = path.join(engineDir, "engine_manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return "manifestNotFound";
      }
      let manifest: MinimumEngineManifestType;
      try {
        manifest = minimumEngineManifestSchema.parse(
          JSON.parse(fs.readFileSync(manifestPath, { encoding: "utf8" })),
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
    // FIXME: この関数の引数でregisteredEngineDirsを受け取り、動かないエンジンをreturnして、EngineManager外でconfig.setする
    for (const engineDir of this.configManager.get("registeredEngineDirs")) {
      const result = addEngine(engineDir, "path");
      if (result !== "ok") {
        log.log(`Failed to load engine: ${result}, ${engineDir}`);
        // 動かないエンジンは追加できないので削除
        // FIXME: エンジン管理UIで削除可能にする
        dialog.showErrorBox(
          "エンジンの読み込みに失敗しました。",
          `${engineDir}を読み込めませんでした。このエンジンは削除されます。`,
        );
        this.configManager.set(
          "registeredEngineDirs",
          this.configManager
            .get("registeredEngineDirs")
            .filter((p) => p !== engineDir),
        );
      }
    }
    return engines;
  }

  /**
   * 全てのエンジンの一覧を取得する。デフォルトエンジン＋追加エンジン。
   */
  fetchEngineInfos(): EngineInfo[] {
    return [...this.defaultEngineInfos, ...this.additionalEngineInfos];
  }

  /**
   * エンジンの情報を取得する。存在しない場合はエラーを返す。
   */
  fetchEngineInfo(engineId: EngineId): EngineInfo {
    const engineInfos = this.fetchEngineInfos();
    const engineInfo = engineInfos.find(
      (engineInfo) => engineInfo.uuid === engineId,
    );
    if (!engineInfo) {
      throw new Error(`No such engineInfo registered: engineId == ${engineId}`);
    }
    return engineInfo;
  }

  /**
   * エンジンのディレクトリを取得する。存在しない場合はエラーを返す。
   */
  fetchEngineDirectory(engineId: EngineId): string {
    const engineInfo = this.fetchEngineInfo(engineId);
    const engineDirectory = engineInfo.path;
    if (engineDirectory == undefined) {
      throw new Error(`engineDirectory is undefined: engineId == ${engineId}`);
    }

    return engineDirectory;
  }

  /**
   * EngineInfosとAltPortInfoを初期化する。
   */
  initializeEngineInfosAndAltPortInfo() {
    this.defaultEngineInfos = createDefaultEngineInfos(this.defaultEngineDir);
    this.additionalEngineInfos = this.createAdditionalEngineInfos();
    this.altPortInfo = {};
  }

  /**
   * 全てのエンジンを起動する。
   */
  async runEngineAll() {
    const engineInfos = this.fetchEngineInfos();
    log.info(`Starting ${engineInfos.length} engine/s...`);

    for (const engineInfo of engineInfos) {
      log.info(`ENGINE ${engineInfo.uuid}: Start launching`);
      await this.runEngine(engineInfo.uuid);
    }
  }

  /**
   * エンジンを起動する。
   */
  async runEngine(engineId: EngineId) {
    const engineInfos = this.fetchEngineInfos();
    const engineInfo = engineInfos.find(
      (engineInfo) => engineInfo.uuid === engineId,
    );

    if (!engineInfo)
      throw new Error(`No such engineInfo registered: engineId == ${engineId}`);

    if (!engineInfo.executionEnabled) {
      log.info(`ENGINE ${engineId}: Skipped engineInfo execution: disabled`);
      return;
    }

    if (!engineInfo.executionFilePath) {
      log.info(
        `ENGINE ${engineId}: Skipped engineInfo execution: empty executionFilePath`,
      );
      return;
    }

    // { hostname (localhost), port (50021) } <- url (http://localhost:50021)
    const engineHostInfo = url2HostInfo(new URL(engineInfo.host));

    log.info(
      `ENGINE ${engineId}: Checking whether port ${engineHostInfo.port} is assignable...`,
    );

    if (
      !(await isAssignablePort(engineHostInfo.port, engineHostInfo.hostname))
    ) {
      // ポートを既に割り当てているプロセスidの取得
      const pid = await getPidFromPort(engineHostInfo);
      if (pid != undefined) {
        const processName = await getProcessNameFromPid(engineHostInfo, pid);
        log.warn(
          `ENGINE ${engineId}: Port ${engineHostInfo.port} has already been assigned by ${processName} (pid=${pid})`,
        );
      } else {
        // ポートは使用不可能だがプロセスidは見つからなかった
        log.warn(
          `ENGINE ${engineId}: Port ${engineHostInfo.port} was unavailable`,
        );
      }

      // 代替ポートの検索
      const altPort = await findAltPort(
        engineHostInfo.port,
        engineHostInfo.hostname,
      );

      // 代替ポートが見つからないとき
      if (altPort == undefined) {
        log.error(`ENGINE ${engineId}: No Alternative Port Found`);
        dialog.showErrorBox(
          `${engineInfo.name} の起動に失敗しました`,
          `${engineHostInfo.port}番ポートの代わりに利用可能なポートが見つかりませんでした。PCを再起動してください。`,
        );
        app.exit(1);
        throw new Error("No Alternative Port Found");
      }

      // 代替ポートの情報
      this.altPortInfo[engineId] = {
        from: engineHostInfo.port,
        to: altPort,
      };

      // 代替ポートを設定
      engineInfo.host = `${engineHostInfo.protocol}//${engineHostInfo.hostname}:${altPort}`;
      log.warn(
        `ENGINE ${engineId}: Applied Alternative Port: ${engineHostInfo.port} -> ${altPort}`,
      );
    }

    log.info(`ENGINE ${engineId}: Starting process`);

    if (!(engineId in this.engineProcessContainers)) {
      this.engineProcessContainers[engineId] = {
        willQuitEngine: false,
      };
    }

    const engineProcessContainer = this.engineProcessContainers[engineId];
    engineProcessContainer.willQuitEngine = false;

    const engineSetting = this.configManager.get("engineSettings")[engineId];
    if (engineSetting == undefined)
      throw new Error(`No such engineSetting: engineId == ${engineId}`);

    const useGpu = engineSetting.useGpu;
    log.info(`ENGINE ${engineId} mode: ${useGpu ? "GPU" : "CPU"}`);

    // エンジンプロセスの起動
    const enginePath = engineInfo.executionFilePath;
    const args = engineInfo.executionArgs.concat(useGpu ? ["--use_gpu"] : [], [
      "--host",
      new URL(engineInfo.host).hostname,
      "--port",
      new URL(engineInfo.host).port,
    ]);

    log.info(`ENGINE ${engineId} path: ${enginePath}`);
    log.info(`ENGINE ${engineId} args: ${JSON.stringify(args)}`);

    const engineProcess = spawn(enginePath, args, {
      cwd: path.dirname(enginePath),
      env: { ...process.env, VV_OUTPUT_LOG_UTF8: "1" },
    });
    engineProcessContainer.engineProcess = engineProcess;

    engineProcess.stdout?.on("data", (data) => {
      log.info(`ENGINE ${engineId} STDOUT: ${data.toString("utf-8")}`);
    });

    engineProcess.stderr?.on("data", (data) => {
      log.error(`ENGINE ${engineId} STDERR: ${data.toString("utf-8")}`);
    });

    // onEngineProcessErrorを一度だけ呼ぶためのフラグ。"error"と"close"がどちらも呼ばれることがある。
    // 詳細 https://github.com/VOICEVOX/voicevox/pull/1053/files#r1051436950
    let errorNotified = false;

    engineProcess.on("error", (err) => {
      log.error(`ENGINE ${engineId} ERROR: ${err}`);
      if (!errorNotified) {
        errorNotified = true;
        this.onEngineProcessError(engineInfo, err);
      }
    });

    engineProcess.on("close", (code, signal) => {
      log.info(
        `ENGINE ${engineId}: Process terminated due to receipt of signal ${signal}`,
      );
      log.info(`ENGINE ${engineId}: Process exited with code ${code}`);

      if (!engineProcessContainer.willQuitEngine) {
        const errorMessage =
          engineInfos.length === 1
            ? "音声合成エンジンが異常終了しました。エンジンを再起動してください。"
            : `${engineInfo.name}が異常終了しました。エンジンを再起動してください。`;
        if (!errorNotified) {
          errorNotified = true;
          this.onEngineProcessError(engineInfo, new Error(errorMessage));
        }
      }
    });
  }

  /**
   * 全てのエンジンに対し、各エンジンを終了するPromiseを返す。
   */
  killEngineAll(): Record<EngineId, Promise<void>> {
    const killingProcessPromises: Record<EngineId, Promise<void>> = {};

    // FIXME: engineProcessContainersをMapにする
    for (const engineIdStr of Object.keys(this.engineProcessContainers)) {
      const engineId = EngineId(engineIdStr);
      const promise = this.killEngine(engineId);
      if (promise == undefined) continue;

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
  killEngine(engineId: EngineId): Promise<void> | undefined {
    const engineProcessContainer = this.engineProcessContainers[engineId];
    if (!engineProcessContainer) {
      log.error(`No such engineProcessContainer: engineId == ${engineId}`);

      return undefined;
    }

    const engineProcess = engineProcessContainer.engineProcess;
    if (engineProcess == undefined) {
      // nop if no process started (already killed or not started yet)
      log.info(`ENGINE ${engineId}: Process not started`);

      return undefined;
    }

    const engineNotExited = engineProcess.exitCode == undefined;
    const engineNotKilled = engineProcess.signalCode == undefined;

    log.info(
      `ENGINE ${engineId}: last exit code: ${engineProcess.exitCode}, signal: ${engineProcess.signalCode}`,
    );

    const isAlive = engineNotExited && engineNotKilled;
    if (!isAlive) {
      log.info(`ENGINE ${engineId}: Process already closed`);

      return undefined;
    }

    const enginePid = engineProcess.pid;
    if (enginePid == undefined) {
      // エンジン起動済みの場合来ないはず
      // 万が一の場合はエンジン停止済みとみなす
      log.error(
        `ENGINE ${engineId}: Process PID is undefined, assuming closed`,
      );
      return undefined;
    }
    return new Promise<void>((resolve, reject) => {
      log.info(`ENGINE ${engineId}: Killing process (PID=${enginePid})`);

      // エラーダイアログを抑制
      engineProcessContainer.willQuitEngine = true;

      // プロセス終了時のイベントハンドラ
      engineProcess.once("close", () => {
        log.info(`ENGINE ${engineId}: Process closed`);
        resolve();
      });

      treeKill(enginePid, (error) => {
        if (error != undefined) {
          log.error(`ENGINE ${engineId}: Error during killing process`);
          reject(error);
        }
      });
    });
  }

  /**
   * エンジンを再起動する。
   */
  async restartEngine(engineId: EngineId) {
    // FIXME: killEngine関数を使い回すようにする
    await new Promise<void>((resolve, reject) => {
      const engineProcessContainer: EngineProcessContainer | undefined =
        this.engineProcessContainers[engineId];
      const engineProcess = engineProcessContainer?.engineProcess;

      log.info(
        `ENGINE ${engineId}: Restarting process (last exit code: ${engineProcess?.exitCode}, signal: ${engineProcess?.signalCode})`,
      );

      // エンジンのプロセスがすでに終了している、またはkillされている場合
      const engineExited = engineProcess?.exitCode != undefined;
      const engineKilled = engineProcess?.signalCode != undefined;

      // engineProcess == undefinedの場合true
      if (engineExited || engineKilled) {
        log.info(
          `ENGINE ${engineId}: Process is not started yet or already killed. Starting process...`,
        );

        this.runEngine(engineId);
        resolve();
        return;
      }

      // エンジンエラー時のエラーウィンドウ抑制用。
      engineProcessContainer.willQuitEngine = true;

      // 「killに使用するコマンドが終了するタイミング」と「OSがプロセスをkillするタイミング」が違うので単純にtreeKillのコールバック関数でrunEngine()を実行すると失敗します。
      // closeイベントはexitイベントよりも後に発火します。
      const restartEngineOnProcessClosedCallback = () => {
        log.info(`ENGINE ${engineId}: Process killed. Restarting process...`);

        this.runEngine(engineId);
        resolve();
      };

      if (engineProcess == undefined) throw Error("engineProcess == undefined");
      if (engineProcess.pid == undefined)
        throw Error("engineProcess.pid == undefined");

      engineProcess.once("close", restartEngineOnProcessClosedCallback);

      // treeKillのコールバック関数はコマンドが終了した時に呼ばれます。
      log.info(
        `ENGINE ${engineId}: Killing current process (PID=${engineProcess.pid})...`,
      );
      treeKill(engineProcess.pid, (error) => {
        // error変数の値がundefined以外であればkillコマンドが失敗したことを意味します。
        if (error != undefined) {
          log.error(`ENGINE ${engineId}: Failed to kill process`);
          log.error(error);

          // killに失敗したとき、closeイベントが発生せず、once listenerが消費されない
          // listenerを削除してENGINEの意図しない再起動を防止
          engineProcess.removeListener(
            "close",
            restartEngineOnProcessClosedCallback,
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
      "utf-8",
    );
    let manifestContent: MinimumEngineManifestType;
    try {
      manifestContent = minimumEngineManifestSchema.parse(JSON.parse(manifest));
    } catch (e) {
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
