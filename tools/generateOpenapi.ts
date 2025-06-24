/**
 * OpenAPI Generator でエンジンのHTTPクライアント（/src/openapi下）を生成するスクリプト。
 *
 * NOTE: 生成元となるOpenAPIはソースから実行しているVOICEVOX ENGINEのものを使用する必要がある。
 */

import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fetchJson } from "./helper.js";

const openapiDir = path.join(import.meta.dirname, "..", "src", "openapi");
const openapiJsonPath = path.join(import.meta.dirname, "..", "openapi.json");

async function main() {
  const engineBase = process.argv[2] || "http://127.0.0.1:50021";
  console.log("Engine base URL:", engineBase);

  await assertDevelopmentEngine(engineBase);

  await updateOpenapiJson(engineBase);
  await runOpenapiGenerator();
}

async function assertDevelopmentEngine(engineBase: string) {
  const version = await fetchJson<string>(`${engineBase}/version`);
  if (version !== "latest") {
    throw new Error(
      `The engine at ${engineBase} is not a development version. Expected "latest", got "${version}".`,
    );
  }

  console.log(`Engine version: ${version}`);
}

async function updateOpenapiJson(engineBase: string) {
  const openapiUrl = `${engineBase}/openapi.json`;
  console.log("Fetching OpenAPI JSON from:", openapiUrl);

  const response = await fetchJson(openapiUrl);
  await fs.writeFile(openapiJsonPath, JSON.stringify(response));

  console.log("OpenAPI JSON updated successfully.");
}

async function runOpenapiGenerator() {
  console.log("Generating OpenAPI client...");
  execSync(
    [
      "pnpm",
      "exec",
      "openapi-generator-cli",
      "generate",
      "-i",
      openapiJsonPath,
      "-o",
      openapiDir,
      "-g",
      "typescript-fetch",
      "--additional-properties",
      "modelPropertyNaming=camelCase,supportsES6=true,withInterfaces=true,typescriptThreePlus=true",
    ].join(" "),
    { stdio: "inherit" },
  );

  console.log("OpenAPI client generated successfully.");
}

void main();
