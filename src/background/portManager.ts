import log from "electron-log";
import tcpPortUsed from "tcp-port-used";

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
  private portLog = (...message: any) =>
    log.info(`PORT ${this.port}: ${message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private portWarn = (...message: any) =>
    log.warn(`PORT ${this.port}: ${message}`);

  public async isPortAssignable() {
    const isAssignable = !(await tcpPortUsed.check(this.port, this.host));
    this.portLog(`isPortAssignable: ${isAssignable}`);
    return isAssignable;
  }
}
