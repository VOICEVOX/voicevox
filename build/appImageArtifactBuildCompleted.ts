import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ArtifactCreated } from "electron-builder";

const vendoredDir = path.join(import.meta.dirname, "..", "vendored");
const appimagetoolPath = path.join(
  vendoredDir,
  "appimagetool",
  "appimagetool.AppImage",
);
const runtimePath = path.join(vendoredDir, "type2-runtime", "runtime");

const fixedAppRunCode = `#!/bin/bash
set -e
apprun="\${APPDIR:-$(dirname "$0")}/AppRunOriginal"
if unshare -Ur true 2>/dev/null ; then
  exec "$apprun" "$@"
else
  exec "$apprun" "$@" --no-sandbox
fi
`;

/**
 * '--no-sandbox'が必要か判定して元のAppRunを呼び出すスクリプトに差し替える
 */
async function fixAppRun(appDir: string) {
  const appRunPath = path.join(appDir, "AppRun");
  await fs.rename(appRunPath, path.join(appDir, "AppRunOriginal"));
  await fs.writeFile(appRunPath, fixedAppRunCode, { mode: 0o755 });
}

/**
 * デフォルトで作成される.desktopファイルのExecキーから'--no-sandbox'を取り除く
 */
async function fixDesktopfile(desktopfilePath: string) {
  const desktopfile = await fs.readFile(desktopfilePath, {
    encoding: "utf-8",
  });
  const fixedDesktopfile = desktopfile.replace(
    /^(Exec=.*)( --no-sandbox(?= |$))(.*)/m,
    "$1$3",
  );
  await fs.writeFile(desktopfilePath, fixedDesktopfile);
}

/*
 * electron-builderが作成したAppImageを修正する
 * appimagetoolで再パッケージすることでlibfuse2をインストール不要にする
 */
export async function appImageArtifactBuildCompleted(
  artifactCreated: ArtifactCreated,
) {
  const artifactPath = artifactCreated.file;
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), "appimage-build"));
  try {
    execFileSync(artifactPath, ["--appimage-extract"], { cwd: tempDir });
    const appDir = path.join(tempDir, "squashfs-root");
    await fixAppRun(appDir);
    const productFilename = artifactCreated.packager.appInfo.productFilename;
    const desktopfilePath = path.join(appDir, `${productFilename}.desktop`);
    await fixDesktopfile(desktopfilePath);
    execFileSync(
      appimagetoolPath,
      ["--no-appstream", "--runtime-file", runtimePath, appDir, artifactPath],
      { stdio: "inherit" },
    );
    // NOTE: AutoUpdaterを使う場合'app-builder-bin blockmap ...'を使用してblockmapを生成する
    // 恐らく以下のコードで動作するようになるかもしれない。
    // import { appBuilderPath } from "app-builder-bin";
    // const result = execFileSync(appBuilderPath, [
    //   "blockmap",
    //   "--input",
    //   artifactPath,
    // ]);
    // const updateInfo = JSON.parse(result.toString());
    // artifactCreated.updateInfo = updateInfo;
  } finally {
    await fs.rm(tempDir, { recursive: true });
  }
}
