/*
 * openapi.jsonのエンドポイントにtagsがないエンドポイントが含まれていると、DefaultApi.tsがtagsなしの物しか生成されない。
 * そのため、openapi.jsonのtagsを空配列にして、全てのエンドポイントを生成する必要がある。
 * このスクリプトは、openapi.jsonのtagsを空配列にしたopenapi-mod.jsonを生成する。
 *
 * FIXME: しっかりとした解決策を考える。
 */

const fs = require("fs");
const openapi = require("./openapi.json");

for (const path in openapi.paths) {
  for (const method in openapi.paths[path]) {
    const operation = openapi.paths[path][method];
    operation.tags = [];
  }
}

fs.writeFileSync("./openapi-mod.json", JSON.stringify(openapi));
console.log("Generated openapi-mod.json");
