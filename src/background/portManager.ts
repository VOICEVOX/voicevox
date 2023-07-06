import { execFileSync } from "child_process";
import log from "electron-log";

const isWindows = process.platform === "win32";

export type HostInfo = {
  protocol: string;
  hostname: string;
  port: number;
};

const portLog = (port: number, message: string, isNested = false) =>
  log.info(`${isNested ? "| " : ""}PORT ${port}: ${message}`);
const portWarn = (port: number, message: string, isNested = false) =>
  log.warn(`${isNested ? "| " : ""}PORT ${port}: ${message}`);

export function url2HostInfo(url: URL): HostInfo {
  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: Number(url.port),
  };
}

/**
 * "netstat -ano" の stdout から, 指定したポートを LISTENING しているプロセスの id を取得します.
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

      if (tcpState === "LISTENING") return Number(pid);
    }
  }

  return undefined;
}

export async function getPidFromPort(
  hostInfo: HostInfo,
  isNested = false // ログ整形用の引数
): Promise<number | undefined> {
  // Windows の場合は, hostname が以下のループバックアドレスが割り当てられているか確認
  const parse4windows = (stdout: string): string | undefined => {
    // それぞれのループバックアドレスに対して pid を取得
    const loopbackAddr = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
    if (!loopbackAddr.includes(hostInfo.hostname)) {
      portLog(
        hostInfo.port,
        `Hostname is not loopback address; Getting process id from ${hostInfo.hostname}...`,
        isNested
      );
      return netstatStdout2pid(stdout, hostInfo)?.toString();
    } else {
      portLog(
        hostInfo.port,
        "Hostname is loopback address; Getting process id from all loopback addresses...",
        isNested
      );

      const pidArr: (number | undefined)[] = [];
      loopbackAddr.forEach((hostname) => {
        // netstat の stdout から pid を取得
        const pid = netstatStdout2pid(stdout, {
          protocol: hostInfo.protocol,
          hostname,
          port: hostInfo.port,
        });

        portLog(
          hostInfo.port,
          `| ${hostname}\t-> ${
            pid == undefined ? "Assignable" : `pid=${pid} uses this port`
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

  // lsofは、ポートを使用しているプロセスが存在しない場合は
  // エラーを返すので、エラーを無視して割り当て可能として扱う
  let stdout: string;
  try {
    stdout = execFileSync(exec.cmd, exec.args, {
      shell: true,
    }).toString();
  } catch (e) {
    portLog(hostInfo.port, "Assignable; Nobody uses this port!", isNested);
    return undefined;
  }

  // Windows の場合は, lsof のように port と pid が 1to1 で取れないので, netstat の stdout をパース
  const pid = isWindows ? parse4windows(stdout) : stdout;

  if (pid == undefined || !pid.length) {
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

export async function getProcessNameFromPid(
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
export async function findAltPort(
  hostInfo: HostInfo
): Promise<number | undefined> {
  const basePort = hostInfo.port;
  portLog(basePort, `Find another assignable port from ${basePort}...`);

  // エンジン指定のポート + 100番までを探索  エフェメラルポートの範囲の最大は超えないようにする
  const altPortMax = Math.min(basePort + 100, 65535);

  for (let altPort = basePort + 1; altPort <= altPortMax; altPort++) {
    portLog(basePort, `Trying whether port ${altPort} is assignable...`);
    const altPid = await getPidFromPort(
      {
        protocol: hostInfo.protocol,
        hostname: hostInfo.hostname,
        port: altPort,
      },
      true
    );

    // ポートを既に割り当てられているプロセスidの取得: undefined → ポートが空いている
    if (altPid == undefined) return altPort;
  }

  portWarn(basePort, `No alternative port found! ${basePort}...${altPortMax}`);
  return undefined;
}
