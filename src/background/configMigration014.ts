// configファイルの場所が0.14で変わったので、以前のファイルを持ってくる
import fs from "fs";
import path from "path";

import semver from "semver";

function _logInfo(message: string) {
  console.info(`configMigration014: ${message}`);
}

function _logError(message: string) {
  console.error(`configMigration014: ${message}`);
}

export default function ({
  fixedUserDataDir,
  beforeUserDataDir,
}: {
  fixedUserDataDir: string;
  beforeUserDataDir: string;
}) {
  try {
    // ファイルが存在していてバージョン0.14以上であれば何もしない
    const configPath = path.join(fixedUserDataDir, "config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

      if (config?.__internal__?.migrations?.version === undefined) {
        throw new Error("configMigration014: config.json is invalid");
      }

      if (semver.satisfies(config.__internal__.migrations.version, ">=0.14")) {
        _logInfo(`>=0.14 ${configPath} exists, do nothing`);
        return;
      }
    }

    // 以前のファイルが存在していればコピー
    const beforeConfigPath = path.join(beforeUserDataDir, "config.json");
    if (fs.existsSync(beforeConfigPath)) {
      // 今のconfigがあれば念のためバックアップ
      if (fs.existsSync(configPath)) {
        const backupPath = path.join(fixedUserDataDir, "config-backup.json");
        _logInfo(`backup to ${backupPath}`);
        fs.copyFileSync(configPath, backupPath);
      }

      _logInfo(`copy from ${beforeConfigPath} to ${configPath}`);
      fs.copyFileSync(beforeConfigPath, configPath);
      return;
    } else {
      _logInfo(`${beforeConfigPath} not exists, do nothing`);
    }
  } catch (e) {
    _logError("error!");
    console.error(e);
  }
}
