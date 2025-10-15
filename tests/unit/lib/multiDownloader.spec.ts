import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { serve, ServerType } from "@hono/node-server";
import { afterAll, beforeAll, expect, test } from "vitest";
import { z } from "zod";
import { MultiDownloader } from "@/backend/electron/multiDownloader";

const marginTime = process.env.CI ? 100 : 50;

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
  server.get(
    "/slow",
    zValidator("query", z.object({ wait: z.string() })),
    async (c) => {
      const wait = Number(c.req.query("wait") ?? "100");
      await new Promise((resolve) => setTimeout(resolve, wait));
      return c.text("This was slow");
    },
  );
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
          url: `${dummyServerUrl}/slow?wait=200`,
        },
        {
          name: "slow2.txt",
          size: 14,
          url: `${dummyServerUrl}/slow?wait=200`,
        },
        {
          name: "slow3.txt",
          size: 14,
          url: `${dummyServerUrl}/slow?wait=200`,
        },
      ],
      tempDir.path,
    );
    const startTime = Date.now();
    await downloader.download();
    const duration = Date.now() - startTime;
    // 200msの遅延 + 多少の余裕。
    // 同時ダウンロードできていなかったら600ms以上かかる
    expect(duration).toBeLessThan(200 + marginTime);
  }
});

test("一つエラーが起きると全体が失敗し、そしてすべて削除される", async () => {
  await using tempDir = await temporaryDirectory();
  const longerDownloadTime = 1000;
  await using downloader = new MultiDownloader(
    [
      {
        name: "slow1.txt",
        size: 14,
        url: `${dummyServerUrl}/slow?wait=${longerDownloadTime}`,
      },
      {
        name: "fail.txt",
        size: 14,
        url: `${dummyServerUrl}/slow-fail`,
      },
      {
        name: "slow3.txt",
        size: 14,
        url: `${dummyServerUrl}/slow?wait=${longerDownloadTime}`,
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
  // 他の長いリクエストを待たずにすぐに失敗しているはず
  expect(Date.now() - currentTime).toBeLessThan(longerDownloadTime);

  // 一つ失敗したので削除されているはず
  for (const filePath of downloadedPaths) {
    await expect(fs.stat(filePath)).rejects.toThrow();
  }
});
