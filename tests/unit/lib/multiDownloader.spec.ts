import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { serve, ServerType } from "@hono/node-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import { MultiDownloader } from "@/backend/electron/multiDownloader";

let dummyServer: ServerType;
const dummyServerPort = 7358;
const dummyServerUrl = `http://localhost:${dummyServerPort}`;
beforeAll(() => {
  const server = new Hono();
  server.get("/simple", (c) => {
    return c.text("Hello, World!");
  });
  server.get("/simple2", (c) => {
    return c.text("Hello, World 2!");
  });
  server.get("/slow", async (c) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return c.text("This was slow");
  });
  server.get("/slow-fail", async (c) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return c.text("This will fail", 500);
  });
  dummyServer = serve({
    ...server,
    port: dummyServerPort,
  });
});
afterAll(() => {
  dummyServer?.close();
});

async function temporaryDirectory() {
  const tempDir = await fs.mkdtemp(
    path.join(tmpdir(), "multi-downloader-test-"),
  );
  return {
    [Symbol.asyncDispose]: async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    },
    path: tempDir,
  };
}

test("テストサーバーが動いている", async () => {
  const response = await fetch(`${dummyServerUrl}/simple`);
  const text = await response.text();
  expect(text).toBe("Hello, World!");
});

test("ファイルをダウンロードして削除できる", async () => {
  await using tempDir = await temporaryDirectory();
  let downloadedPaths: string[] = [];
  {
    await using downloader = new MultiDownloader(
      [
        {
          name: "simple.txt",
          size: 13,
          url: `${dummyServerUrl}/simple`,
        },
        {
          name: "simple2.txt",
          size: 14,
          url: `${dummyServerUrl}/simple2`,
        },
      ],
      tempDir.path,
    );
    await downloader.download();
    expect(downloader.downloadedPaths).toStrictEqual([
      path.join(tempDir.path, "simple.txt"),
      path.join(tempDir.path, "simple2.txt"),
    ]);
    for (const filePath of downloader.downloadedPaths) {
      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);
    }
    downloadedPaths = downloader.downloadedPaths;
  }

  // スコープを抜けると削除される
  for (const filePath of downloadedPaths) {
    await expect(fs.stat(filePath)).rejects.toThrow();
  }
});

test("複数ファイルを同時にダウンロードできる", async () => {
  await using tempDir = await temporaryDirectory();
  {
    await using downloader = new MultiDownloader(
      [
        {
          name: "slow1.txt",
          size: 14,
          url: `${dummyServerUrl}/slow`,
        },
        {
          name: "slow2.txt",
          size: 14,
          url: `${dummyServerUrl}/slow`,
        },
        {
          name: "slow3.txt",
          size: 14,
          url: `${dummyServerUrl}/slow`,
        },
      ],
      tempDir.path,
    );
    const startTime = Date.now();
    await downloader.download();
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(200 + 50); // 200msの遅延 + 50msの余裕。同時ダウンロードできていなかったら600ms以上かかる
  }
});

test("一つエラーが起きると全体が失敗し、そしてすべて削除される", async () => {
  await using tempDir = await temporaryDirectory();
  await using downloader = new MultiDownloader(
    [
      {
        name: "slow1.txt",
        size: 14,
        url: `${dummyServerUrl}/slow`,
      },
      {
        name: "fail.txt",
        size: 14,
        url: `${dummyServerUrl}/slow-fail`,
      },
      {
        name: "slow3.txt",
        size: 14,
        url: `${dummyServerUrl}/slow`,
      },
    ],
    tempDir.path,
  );

  const downloadedPaths = [
    path.join(tempDir.path, "slow1.txt"),
    path.join(tempDir.path, "fail.txt"),
    path.join(tempDir.path, "slow3.txt"),
  ];
  const currentTime = Date.now();
  await expect(downloader.download()).rejects.toThrow();
  expect(Date.now() - currentTime).toBeLessThan(100); // 200ms待たずに失敗しているはず

  // 一つ失敗したので削除されているはず
  for (const filePath of downloadedPaths) {
    await expect(fs.stat(filePath)).rejects.toThrow();
  }
});
