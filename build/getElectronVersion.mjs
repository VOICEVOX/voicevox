// @ts-check

// Electron内部のNode.jsのバージョンとChromiumのバージョンを取得するスクリプト
// 必ず環境変数"ELECTRON_RUN_AS_NODE"を設定した上でElectronを使って実行する必要がある。
process.on("uncaughtException", () => {
  process.exit(1);
});

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
