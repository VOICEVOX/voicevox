import log from "electron-log";

const setLogFileName = () => {
  //ファイル名に日時を指定
  const d = new Date();
  const prefix =
    d.getFullYear() +
    ("00" + (d.getMonth() + 1)).slice(-2) +
    ("00" + d.getDate()).slice(-2) +
    "_" +
    ("00" + d.getHours()).slice(-2) +
    ("00" + d.getMinutes()).slice(-2) +
    ("00" + d.getSeconds()).slice(-2);
  log.transports.file.fileName = `${prefix}_error.log`;
};

export const logError = (...params: unknown[]): void => {
  setLogFileName();
  log.error(...params);
};
