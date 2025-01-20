import { execFileSync } from "child_process";
import { createServer } from "net";
import { createLogger } from "@/helpers/log";

const log = createLogger("portHelper");

const isWindows = process.platform === "win32";

export type HostInfo = {
  protocol: string;
  hostname: string;
  port: number;
};

const portLog = (port: number, message: string, isNested = false) => {
  log.info(`${isNested ? "| " : ""}PORT ${port}: ${message}`);
};
const portWarn = (port: number, message: string, isNested = false) => {
  log.warn(`${isNested ? "| " : ""}PORT ${port}: ${message}`);
};

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
  hostInfo: HostInfo,
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
  isNested = false, // ログ整形用の引数
): Promise<number | undefined> {
  // Windows の場合は, hostname が以下のループバックアドレスが割り当てられているか確認
  const parse4windows = (stdout: string): string | undefined => {
    // それぞれのループバックアドレスに対して pid を取得
    const loopbackAddr = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
    if (!loopbackAddr.includes(hostInfo.hostname)) {
      portLog(
        hostInfo.port,
        `Hostname is not loopback address; Getting process id from ${hostInfo.hostname}...`,
        isNested,
      );
      return netstatStdout2pid(stdout, hostInfo)?.toString();
    } else {
      portLog(
        hostInfo.port,
        "Hostname is loopback address; Getting process id from all loopback addresses...",
        isNested,
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
          isNested,
        );

        pidArr.push(pid);
      });

      // pid が undefined (= 割り当て可能) でないものを取得 → 1つ目を取得
      return pidArr.filter((pid) => pid != undefined)[0]?.toString();
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
    isNested,
  );

  // lsofは、ポートを使用しているプロセスが存在しない場合は
  // エラーを返すので、エラーを無視して割り当て可能として扱う
  // FIXME: lsof以外のエラーだった場合のエラーハンドリングを追加する
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

  if (!pid?.length) {
    portLog(hostInfo.port, "Assignable; Nobody uses this port!", isNested);
    return undefined;
  }

  portWarn(
    hostInfo.port,
    `Nonassignable; pid=${pid} uses this port!`,
    isNested,
  );
  return Number(pid);
}

export async function getProcessNameFromPid(
  hostInfo: HostInfo,
  pid: number,
): Promise<string | undefined> {
  portLog(hostInfo.port, `Getting process name from pid=${pid}...`);
  const exec = isWindows
    ? {
        cmd: "tasklist",
        args: ["/FI", `"PID eq ${pid}"`, "/NH"],
      }
    : {
        cmd: "ps",
        args: ["-p", pid.toString(), "-o", "comm="],
      };

  const stdout = execFileSync(exec.cmd, exec.args, { shell: true }).toString();

  /*
   * ex) stdout:
   * ```
   *
   * node.exe     25180 Console   1     86,544 K
   * ```
   * -> `node.exe`
   */
  const processName = (
    isWindows ? stdout.split("\r\n").at(1)?.split(/ +/)?.at(0) : stdout
  )?.trim();

  if (processName == undefined) {
    portWarn(hostInfo.port, `Not found process name from pid=${pid}!`);
    return undefined;
  } else {
    portLog(hostInfo.port, `Found process name: ${processName}`);
    return processName;
  }
}

/**
 * ポートが割り当て可能かどうか実際にlistenして接続したポート番号を返します。
 * 0番ポートを指定した場合はランダムな接続可能ポート番号を返します。
 * @param port 確認するポート番号
 * @param hostname 確認するホスト名
 * @returns 割り当て不能だった場合`undefined`を返します。割り当て可能だった場合ポート番号を返します。
 */
function findOrCheckPort(
  port: number,
  hostname: string,
): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", () => {
      server.close();
      resolve(undefined);
    });
    server.on("listening", () => {
      const address = server.address();
      server.close();
      if (address == undefined || typeof address === "string") {
        reject(new Error(`'address' is null or string: ${address}`));
        return;
      }
      resolve(address.port);
    });
    server.listen(port, hostname);
  });
}

/**
 * 割り当て可能な他のポートを探します
 * @param basePort 元のポート番号
 * @param hostname 割り当てるホスト名
 * @returns 割り当て可能なポート番号 or `undefined` (割り当て可能なポートが見つからなかったとき)
 */
export async function findAltPort(
  basePort: number,
  hostname: string,
): Promise<number | undefined> {
  portLog(basePort, `Find another assignable port from ${basePort}...`);

  // エンジン指定のポート + 100番までを探索  エフェメラルポートの範囲の最大は超えないようにする
  const altPortMax = Math.min(basePort + 100, 65535);

  for (let altPort = basePort + 1; altPort <= altPortMax; altPort++) {
    portLog(basePort, `Trying whether port ${altPort} is assignable...`);
    if (await isAssignablePort(altPort, hostname)) {
      return altPort;
    }
  }

  // 指定のポート + 100番まで見つからなかった場合ランダムなポートを使用する
  portWarn(basePort, `No alternative port found! ${basePort}...${altPortMax}`);
  const altPort = await findOrCheckPort(0, hostname);
  if (altPort == undefined) {
    portWarn(basePort, "No alternative port found!");
  } else {
    portLog(altPort, "Assignable");
  }
  return altPort;
}

/**
 * ポートが割り当て可能か確認します
 * @param port 確認するポート番号
 * @param hostname 確認するホスト名
 */
export async function isAssignablePort(port: number, hostname: string) {
  return (await findOrCheckPort(port, hostname)) != undefined;
}
