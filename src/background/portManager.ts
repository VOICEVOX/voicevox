import { execFileSync } from "child_process";
import log from "electron-log";

const isWindows = process.platform === "win32";

export class PortManager {
  constructor(private url: string) {}

  /**
   * ex) url: `http://localhost:50021`
   *  host -> `localhost`
   *  port -> `50021`
   */
  public host = this.url.split(":")[1].slice(2);
  public port = parseInt(this.url.split(":")[2]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  portLog = (...message: any) => log.info(`PORT ${this.port}: ${message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  portWarn = (...message: any) => log.warn(`PORT ${this.port}: ${message}`);

  /**
   * Parses stdout from `netstat -ano` command and returns process id
   *
   * ex) stdout:
   * ``` cmd
   * TCP  127.0.0.1:5173   127.0.0.1:50170  TIME_WAIT  0
   * TCP  127.0.0.1:6463   0.0.0.0:0        LISTENING  18692
   * TCP  127.0.0.1:50021  0.0.0.0:0        LISTENING  17320
   * ```
   * -> `17320`
   *
   * @param stdout stdout from netstat command
   * @returns `process id` or `undefined`
   */
  private stdout2processId(stdout: string): number | undefined {
    const lines = stdout.split("\n");
    for (const line of lines) {
      if (line.includes(`${this.host}:${this.port}`)) {
        const parts = line.trim().split(/\s+/);
        return parseInt(parts[parts.length - 1], 10);
      }
    }
    return undefined;
  }

  async getProcessIdFromPort(): Promise<number | undefined> {
    this.portLog("Getting process id ...");
    const exec = isWindows
      ? {
          cmd: "netstat",
          args: ["-ano"],
        }
      : {
          cmd: "lsof",
          args: ["-i", `:${this.port}`, "-t", "-sTCP:LISTEN"],
        };

    this.portLog(`Running command: "${exec.cmd} ${exec.args.join(" ")}"`);

    const stdout = execFileSync(exec.cmd, exec.args, {
      shell: true,
    }).toString();

    // windows
    if (isWindows) {
      const result = this.stdout2processId(stdout);
      if (!result) {
        this.portLog("Assignable; Nobody uses this port!");
        return undefined;
      }
      this.portWarn(`Nonassignable; pid=${result} uses this port!`);
      return result;
    }

    // bash
    if (!stdout || !stdout.length) {
      this.portLog("Assignable; Nobody uses this port!");
      return undefined;
    }
    this.portWarn(`Nonassignable; pid=${stdout} uses this port!`);
    return parseInt(stdout);
  }

  async getProcessNameFromPid(pid: number): Promise<string> {
    this.portLog(`Getting process name from pid=${pid}...`);
    const exec = isWindows
      ? {
          cmd: "wmic",
          args: ["process", "where", `"ProcessID=${pid}"`, "get", "name"],
        }
      : {
          cmd: "ps",
          args: ["-p", pid.toString(), "-o", "comm="],
        };

    let stdout = execFileSync(exec.cmd, exec.args, { shell: true }).toString();

    if (isWindows) {
      /*
       * ex) stdout:
       * ```
       * Name
       * node.exe
       * ```
       * -> `node.exe`
       */
      stdout = stdout.split("\r\n")[1];
    }

    this.portLog(`Found process name: ${stdout}`);

    return stdout.trim();
  }
}
