import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { expect, test } from "vitest";
import { MultiDownloader } from "@/backend/electron/multiDownloader";

const marginTime = 100;

class TestServer {
  server: http.Server;

  constructor(
    private endpoints: Record<
      string,
      (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>
    >,
  ) {
    this.server = http.createServer(this.requestListener.bind(this));
    this.server.listen(0);
  }

  get url() {
    const address = this.server.address();
    if (address && typeof address === "object") {
      return `http://localhost:${address.port}`;
    } else {
      throw new Error("Server is not running");
    }
  }

  requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url ?? "";
    const parsedUrl = new URL(url, "http://localhost");
    const pathname = parsedUrl.pathname;
    const handler = this.endpoints[pathname];
    if (handler) {
      void handler(req, res).catch((err: unknown) => {
        if (
          typeof err === "object" &&
          err != null &&
          "code" in err &&
          err.code === "ECONNRESET"
        ) {
          // クライアントが切断した場合は無視
          return;
        }
        throw err;
      });
    } else {
      res.statusCode = 404;
      res.end("Not Found");
    }
  }

  [Symbol.asyncDispose]() {
    return new Promise<void>((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }
}

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
  await using dummyServer = new TestServer({
    "/simple": async (_req, res) => {
      res.statusCode = 200;
      res.end("Hello, World!");
    },
  });
  const response = await fetch(`${dummyServer.url}/simple`);
  const text = await response.text();
  expect(text).toBe("Hello, World!");
});

test("ファイルをダウンロードして削除できる", async () => {
  await using tempDir = await temporaryDirectory();
  await using dummyServer = new TestServer({
    "/simple": async (_req, res) => {
      res.statusCode = 200;
      res.end("Hello, World!");
    },
    "/simple2": async (_req, res) => {
      res.statusCode = 200;
      res.end("Hello, World!!");
    },
  });
  let downloadedPaths: string[] = [];
  {
    await using downloader = new MultiDownloader(
      [
        {
          name: "simple.txt",
          size: 13,
          url: `${dummyServer.url}/simple`,
        },
        {
          name: "simple2.txt",
          size: 14,
          url: `${dummyServer.url}/simple2`,
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
  await using dummyServer = new TestServer({
    "/slow": async (_req, res) => {
      await new Promise((r) => setTimeout(r, 200));
      res.statusCode = 200;
      res.end("Hello, World!\n");
    },
  });
  {
    await using downloader = new MultiDownloader(
      [
        {
          name: "slow1.txt",
          size: 14,
          url: `${dummyServer.url}/slow`,
        },
        {
          name: "slow2.txt",
          size: 14,
          url: `${dummyServer.url}/slow`,
        },
        {
          name: "slow3.txt",
          size: 14,
          url: `${dummyServer.url}/slow`,
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

test("一つエラーが起きると全体が失敗し、かつそのときでもクリーンアップできる", async () => {
  await using tempDir = await temporaryDirectory();
  await using dummyServer = new TestServer({
    "/slow-100": async (_req, res) => {
      await new Promise((r) => setTimeout(r, 100));
      res.statusCode = 200;
      res.end("Hello, World!\n");
    },
    "/slow-1000": async (_req, res) => {
      await new Promise((r) => setTimeout(r, 1000));
      res.statusCode = 200;
      res.end("Hello, World!\n");
    },
    "/slow-fail": async (_req, res) => {
      await new Promise((r) => setTimeout(r, 500));
      res.statusCode = 500;
      res.end("Internal Server Error\n");
    },
  });
  {
    await using downloader = new MultiDownloader(
      [
        {
          name: "slow1.txt",
          size: 14,
          url: `${dummyServer.url}/slow-100`,
        },
        {
          name: "fail.txt",
          size: 14,
          url: `${dummyServer.url}/slow-fail`,
        },
        {
          name: "slow3.txt",
          size: 14,
          url: `${dummyServer.url}/slow-1000`,
        },
      ],
      tempDir.path,
    );

    const currentTime = Date.now();
    await expect(downloader.download()).rejects.toThrow();
    // 他の長いリクエストを待たずにすぐに失敗しているはず
    expect(Date.now() - currentTime).toBeLessThan(500 + marginTime);
  }

  const downloadedPaths = [
    path.join(tempDir.path, "slow1.txt"),
    path.join(tempDir.path, "fail.txt"),
    path.join(tempDir.path, "slow3.txt"),
  ];
  // スコープを抜けると削除される
  for (const filePath of downloadedPaths) {
    await expect(fs.stat(filePath)).rejects.toThrow();
  }
});
