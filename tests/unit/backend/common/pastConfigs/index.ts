import config013 from "./0.13.json";
import config019_1 from "./0.19.1-bug_default_preset.json";

const pastConfigs: [
  string,
  Record<string, unknown> & {
    __internal__: { migrations: { version: string } };
  },
][] = [
  ["0.13.0", config013],
  ["0.19.1", config019_1],
];

export default pastConfigs;
