// @ts-check
// Electron内部のNode.jsのバージョンとChromiumのバージョンを取得するスクリプト
// 必ずElectronを使って実行する必要がある。
import { app } from "electron";
process.on("uncaughtException", () => {
  process.exit(1);
});

/**
 * @param {string} prefix
 * @param {string} rawVersion
 * @return {string}
 */
function processVersion(prefix, rawVersion) {
  const version = rawVersion.split(".").slice(0, 3).join(".");
  return `${prefix}${version}`;
}

process.stdout.write(
  JSON.stringify({
    node: processVersion("node", process.versions.node),
    chrome: processVersion("chrome", process.versions.chrome),
  }),
);
app.quit();
