/**
 * Dockerを使ってVRTを実行するスクリプト。
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { userInfo } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const nodeVersion = readFileSync(
  path.join(root, ".node-version"),
  "utf8",
).trim();
const image = "voicevox-vrt";
const platform = "linux/amd64";
const options = { cwd: root, stdio: "inherit" } as const;

// Linuxではuid・gidを指定してホストのユーザーとしてファイルを作成するようにする。
const userArgs =
  process.platform === "linux"
    ? ["--user", `${userInfo().uid}:${userInfo().gid}`]
    : [];

execFileSync(
  "docker",
  [
    "build",
    "--platform",
    platform,
    "--build-arg",
    `NODE_VERSION=${nodeVersion}`,
    "--file",
    "tools/vrt.dockerfile",
    "--tag",
    image,
    ".",
  ],
  options,
);

mkdirSync(path.join(root, "node_modules"), { recursive: true });

for (const [target, command] of [
  ["browser", ["test:browser-e2e"]],
  ["storybook", ["test:storybook-vrt"]],
] as const) {
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "--init",
      "--ipc=host",
      "--platform",
      platform,
      ...userArgs,
      "--mount",
      `type=bind,source=${root},target=/workspace`,
      "--mount",
      "type=volume,target=/workspace/node_modules",
      "--env",
      `PLAYWRIGHT_HTML_OUTPUT_DIR=/workspace/playwright-report/vrt-${target}`,
      image,
      "pnpm",
      "run",
      ...command,
      "--grep=@vrt",
      `--output=test-results/vrt-${target}`,
      ...process.argv.slice(2),
    ],
    options,
  );
}
