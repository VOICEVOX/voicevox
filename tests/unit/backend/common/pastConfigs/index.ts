import config013 from "./0.13.json";

const pastConfigs: [
  string,
  Record<string, unknown> & {
    __internal__: { migrations: { version: string } };
  },
][] = [["0.13.0", config013]];

export default pastConfigs;
