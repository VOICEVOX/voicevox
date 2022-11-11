import { EngineManifest } from "@/openapi";
import fs from "fs";
import path from "path";
import yauzl from "yauzl";

export async function extractVvpp(
  vvppPath: string,
  outputDir: string
): Promise<EngineManifest> {
  const zipFile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(vvppPath, { lazyEntries: true }, (error, zipFile) => {
      if (error != null) {
        reject(error);
        return;
      }
      resolve(zipFile);
    });
  });
  zipFile.readEntry();
  await new Promise<void>((resolve, reject) => {
    const promises: Promise<void>[] = [];
    zipFile.on("entry", async (entry: yauzl.Entry) => {
      zipFile.openReadStream(entry, (error, readStream) => {
        if (error != null) {
          reject(error);
          return;
        }
        if (/\/$/.test(entry.fileName)) {
          fs.mkdirSync(path.join(outputDir, entry.fileName));
          zipFile.readEntry();
          return;
        }
        promises.push(
          new Promise<void>((resolve2) => {
            readStream.on("end", () => {
              zipFile.readEntry();
              resolve2();
            });
            readStream.pipe(
              fs.createWriteStream(path.join(outputDir, entry.fileName))
            );
          })
        );
      });
    });
    promises.push(
      new Promise<void>((resolve2) => {
        zipFile.on("end", () => {
          resolve2();
        });
      })
    );
    Promise.all(promises).then(() => {
      resolve();
    });
  });
  // FIXME: バリデーションをかける
  const manifest = JSON.parse(
    await fs.promises.readFile(
      path.join(outputDir, "engine_manifest.json"),
      "utf-8"
    )
  ) as EngineManifest;
  return manifest;
}
