import { spawn, ChildProcess } from "child_process";
import path from "path";
import treeKill from "tree-kill";

import { app, dialog } from "electron"; // FIXME: ここでelectronをimportするのは良くない

import {
  findAltPort,
  getPidFromPort,
  getProcessNameFromPid,
  type HostInfo,
  isAssignablePort,
} from "../portHelper";

import { getConfigManager } from "../electronConfig";
import { getEngineInfoManager } from "./engineInfoManager";
import { EngineId, EngineInfo } from "@/type/preload";
import { createLogger } from "@/helpers/log";

const log = createLogger("EngineProcessManager");

type EngineProcessContainer = {
  willQuitEngine: boolean;
  engineProcess?: ChildProcess;
};

/** エンジンプロセスを管理するクラス */
export class EngineProcessManager {
  onEngineProcessError: (engineInfo: EngineInfo, error: Error) => void;

  defaultEngineInfos: EngineInfo[] = [];
  additionalEngineInfos: EngineInfo[] = [];
  engineProcessContainers: Record<EngineId, EngineProcessContainer> = {};

  constructor(payload: {
    onEngineProcessError: (engineInfo: EngineInfo, error: Error) => void;
  }) {
    this.onEngineProcessError = payload.onEngineProcessError;
  }

  private get configManager() {
    return getConfigManager();
  }
  private get engineInfoManager() {
    return getEngineInfoManager();
  }

  /**
   * 全てのエンジンを起動する。
   */
  async runEngineAll() {
    const engineInfos = this.engineInfoManager.fetchEngineInfos();
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
    const engineInfos = this.engineInfoManager.fetchEngineInfos();
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
    const engineHostInfo: HostInfo = {
      protocol: engineInfo.protocol,
      hostname: engineInfo.hostname,
      port: Number(engineInfo.defaultPort),
    };

    // ポートが塞がっていれば代替ポートを探す
    let port = engineHostInfo.port;
    log.info(
      `ENGINE ${engineId}: Checking whether port ${port} is assignable...`,
    );

    if (!(await isAssignablePort(port, engineHostInfo.hostname))) {
      // ポートを既に割り当てているプロセスidの取得
      const pid = await getPidFromPort(engineHostInfo);
      if (pid != undefined) {
        const processName = await getProcessNameFromPid(engineHostInfo, pid);
        log.warn(
          `ENGINE ${engineId}: Port ${port} has already been assigned by ${processName ?? "(not found)"} (pid=${pid})`,
        );
      } else {
        // ポートは使用不可能だがプロセスidは見つからなかった
        log.warn(`ENGINE ${engineId}: Port ${port} was unavailable`);
      }

      // 代替ポートの検索
      const altPort = await findAltPort(port, engineHostInfo.hostname);

      // 代替ポートが見つからないとき
      if (altPort == undefined) {
        log.error(`ENGINE ${engineId}: No Alternative Port Found`);
        dialog.showErrorBox(
          `${engineInfo.name} の起動に失敗しました`,
          `${port}番ポートの代わりに利用可能なポートが見つかりませんでした。PCを再起動してください。`,
        );
        app.exit(1);
        throw new Error("No Alternative Port Found");
      }

      // 代替ポート情報を更新
      this.engineInfoManager.updateAltPort(engineId, altPort);
      log.warn(
        `ENGINE ${engineId}: Applied Alternative Port: ${port} -> ${altPort}`,
      );

      port = altPort;
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
      engineHostInfo.hostname,
      "--port",
      port.toString(),
    ]);

    log.info(`ENGINE ${engineId} path: ${enginePath}`);
    log.info(`ENGINE ${engineId} args: ${JSON.stringify(args)}`);

    const engineProcess = spawn(enginePath, args, {
      cwd: path.dirname(enginePath),
      env: { ...process.env, VV_OUTPUT_LOG_UTF8: "1" },
    });
    engineProcessContainer.engineProcess = engineProcess;

    engineProcess.stdout?.on("data", (data: Buffer) => {
      log.info(`ENGINE ${engineId} STDOUT: ${data.toString("utf-8")}`);
    });

    engineProcess.stderr?.on("data", (data: Buffer) => {
      log.error(`ENGINE ${engineId} STDERR: ${data.toString("utf-8")}`);
    });

    // onEngineProcessErrorを一度だけ呼ぶためのフラグ。"error"と"close"がどちらも呼ばれることがある。
    // 詳細 https://github.com/VOICEVOX/voicevox/pull/1053/files#r1051436950
    let errorNotified = false;

    engineProcess.on("error", (err) => {
      log.error(`ENGINE ${engineId} ERROR:`, err);
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

        void this.runEngine(engineId);
        resolve();
        return;
      }

      // エンジンエラー時のエラーウィンドウ抑制用。
      engineProcessContainer.willQuitEngine = true;

      // 「killに使用するコマンドが終了するタイミング」と「OSがプロセスをkillするタイミング」が違うので単純にtreeKillのコールバック関数でrunEngine()を実行すると失敗します。
      // closeイベントはexitイベントよりも後に発火します。
      const restartEngineOnProcessClosedCallback = () => {
        log.info(`ENGINE ${engineId}: Process killed. Restarting process...`);

        void this.runEngine(engineId);
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

          reject(error);
        }
      });
    });
  }
}

let manager: EngineProcessManager | undefined;

export function initializeEngineProcessManager(payload: {
  onEngineProcessError: (engineInfo: EngineInfo, error: Error) => void;
}) {
  manager = new EngineProcessManager(payload);
}

export function getEngineProcessManager() {
  if (manager == undefined) {
    throw new Error("EngineProcessManager is not initialized");
  }
  return manager;
}
