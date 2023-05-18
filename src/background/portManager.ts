import { execFileSync } from "child_process";
import log from "electron-log";

const isWindows = process.platform === "win32";

type HostInfo = {
  hostname: string;
  port: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const portLog = (port: number, message: string, isNested = false) =>
  log.info(`${isNested ? "| " : ""}PORT ${port}: ${message}`);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const portWarn = (port: number, message: string, isNested = false) =>
  log.warn(`${isNested ? "| " : ""}PORT ${port}: ${message}`);

function url2HostInfo(url: URL) {
  return {
    hostname: url.hostname,
    port: Number(url.port),
  };
}

/**
 * "netstat -ano" の stdout から, 指定したポートを使用しているプロセスの process id を取得します.
 * また, TCPの状態が TIME_WAIT のときはポートが割り当て可能だとみなします.
 *
 * ex) stdout:
 * ``` cmd
 * TCP  127.0.0.1:5173   127.0.0.1:50170  TIME_WAIT  0
 * TCP  127.0.0.1:6463   0.0.0.0:0        LISTENING  18692
 * TCP  127.0.0.1:50021  0.0.0.0:0        LISTENING  17320
 * ```
 * -> `17320`
 *
 * @param stdout netstat の stdout
 * @param hostInfo ホスト情報
 * @returns `process id` or `undefined` (ポートが割り当て可能なとき)
 */
function netstatStdout2pid(
  stdout: string,
  hostInfo: HostInfo
): number | undefined {
  const lines = stdout.split("\n");

  for (const line of lines) {
    if (line.includes(`${hostInfo.hostname}:${hostInfo.port}`)) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      const tcpState = parts[parts.length - 2];

      // 他のプロセスが割り当てをしているとみなすTCPの状態
      if (["LISTENING", "ESTABLISHED", "CLOSE_WAIT"].includes(tcpState)) {
        return Number(pid);
      }
    }
  }

  return undefined;
}

async function getPidFromPort(
  hostInfo: HostInfo,
  isNested = false
): Promise<number | undefined> {
  // Windows の場合は, hostname が以下のループバックアドレスが割り当てられているか確認
  const parse4windows = (): string | undefined => {
    // それぞれのループバックアドレスに対して pid を取得
    const loopbackAddr = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
    if (loopbackAddr.includes(hostInfo.hostname)) {
      portLog(
        hostInfo.port,
        "Hostname is loopback address; Getting process id from all loopback addresses...",
        isNested
      );

      const pidArr: (number | undefined)[] = [];
      loopbackAddr.forEach((hostname) => {
        // netstat の stdout から pid を取得
        const pid = netstatStdout2pid(stdout, {
          hostname,
          port: hostInfo.port,
        });

        portLog(
          hostInfo.port,
          `| ${hostname}\t-> ${
            pid == null ? "Assignable" : `pid=${pid} uses this port`
          }`,
          isNested
        );

        pidArr.push(pid);
      });

      // pid が undefined (= 割り当て可能) でないものを取得 → 1つ目を取得
      return pidArr.filter((pid) => pid !== undefined)[0]?.toString();
    }
  };

  portLog(hostInfo.port, "Getting process id...", isNested);

  const exec = isWindows
    ? {
        cmd: "netstat",
        args: ["-ano"],
      }
    : {
        cmd: "lsof",
        args: ["-i", `:${hostInfo.port}`, "-t", "-sTCP:LISTEN"],
      };

  portLog(
    hostInfo.port,
    `Running command: "${exec.cmd} ${exec.args.join(" ")}"...`,
    isNested
  );

  const stdout = execFileSync(exec.cmd, exec.args, {
    shell: true,
  }).toString();

  // Windows の場合は, lsof のように port と pid が 1to1 で取れないので, netstat の stdout をパース
  const pid = isWindows ? parse4windows() : stdout;

  if (pid == null || !pid.length) {
    portLog(hostInfo.port, "Assignable; Nobody uses this port!", isNested);
    return undefined;
  }

  portWarn(
    hostInfo.port,
    `Nonassignable; pid=${pid} uses this port!`,
    isNested
  );
  return Number(pid);
}

async function getProcessNameFromPid(
  hostInfo: HostInfo,
  pid: number
): Promise<string> {
  portLog(hostInfo.port, `Getting process name from pid=${pid}...`);
  const exec = isWindows
    ? {
        cmd: "wmic",
        args: ["process", "where", `"ProcessID=${pid}"`, "get", "name"],
      }
    : {
        cmd: "ps",
        args: ["-p", pid.toString(), "-o", "comm="],
      };

  const stdout = execFileSync(exec.cmd, exec.args, { shell: true }).toString();

  /*
   * ex) stdout:
   * ```
   * Name
   * node.exe
   * ```
   * -> `node.exe`
   */
  const processName = isWindows ? stdout.split("\n")[1] : stdout;

  portLog(hostInfo.port, `Found process name: ${processName}`);
  return processName.trim();
}

/**
 * 割り当て可能な他のポートを探します
 *
 * @param hostInfo ホスト情報
 * @returns 割り当て可能なポート番号 or `undefined` (割り当て可能なポートが見つからなかったとき)
 */
async function findAltPort(hostInfo: HostInfo): Promise<number | undefined> {
  const basePort = hostInfo.port;
  portLog(hostInfo.port, `Find another assignable port from ${basePort}...`);

  // エンジン指定のポート + 100番までを探索  エフェメラルポートの範囲の最大は超えないようにする
  const altPortMax = Math.min(basePort + 100, 65535);

  for (let altPort = basePort + 1; altPort <= altPortMax; altPort++) {
    portLog(hostInfo.port, `Trying whether port ${altPort} is assignable...`);
    const altPid = await getPidFromPort(
      {
        hostname: hostInfo.hostname,
        port: altPort,
      },
      true
    );

    // ポートを既に割り当てられているプロセスidの取得: undefined → ポートが空いている
    if (altPid == null) return altPort;
  }

  portWarn(
    hostInfo.port,
    `No alternative port found! ${basePort}...${altPortMax}`
  );
  return undefined;
}

export type { HostInfo };
export { url2HostInfo, getPidFromPort, getProcessNameFromPid, findAltPort };
