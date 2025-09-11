import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ArtifactCreated } from "electron-builder";

const appimagetoolPath = path.join(
  import.meta.dirname,
  "..",
  "vendored",
  "appimagetool",
  "appimagetool.AppImage",
);

const injectCode = `
if ! unshare -Ur true 2>/dev/null ; then
  args+=("--no-sandbox")
  NUMBER_OF_ARGS=$((NUMBER_OF_ARGS + 1))
fi
`;

/**
 * AppRunスクリプトに'--no-sandbox'が必要か判定して自動的に追加するコードを注入する
 */
async function fixAppRun(appDir: string) {
  const appRunPath = path.join(appDir, "AppRun");
  const appRun = await fs.readFile(appRunPath, {
    encoding: "utf-8",
  });
  const searchPattern = /^args=\("\$@"\)\nNUMBER_OF_ARGS="\$#"$/m;
  if (!searchPattern.test(appRun) || appRun.search("--no-sandbox") >= 0) {
    // 想定するコードが存在しない、または同様のコードが実装されている可能性がある
    throw new Error(
      "electron-builder等の更新によりAppRunが予期せぬコードに変更されています。",
    );
  }
  const fixdAppRun = appRun.replace(searchPattern, `$&\n${injectCode}`);
  await fs.writeFile(appRunPath, fixdAppRun);
}

/**
 * デフォルトで作成される.desktopファイルのExecキーから'--no-sandbox'を取り除く
 */
async function fixDesktopfile(desktopfilePath: string) {
  const desktopfile = await fs.readFile(desktopfilePath, {
    encoding: "utf-8",
  });
  const fixdDesktopfile = desktopfile.replace(
    /^(Exec=.*)( --no-sandbox(?= |$))(.*)/m,
    "$1$3",
  );
  await fs.writeFile(desktopfilePath, fixdDesktopfile);
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
    execFileSync(appimagetoolPath, ["--no-appstream", appDir, artifactPath], {
      stdio: "inherit",
    });
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
