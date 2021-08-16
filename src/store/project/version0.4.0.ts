import Ajv, { JTDDataType } from "ajv/dist/jtd";
import { VersionType, ProjectBaseType } from ".";
import { ProjectType as PostType } from "./version0.3.0";

const moraSchema = {
  properties: {
    text: { type: "string" },
    vowel: { type: "string" },
    pitch: { type: "float32" },
  },
  optionalProperties: {
    consonant: { type: "string" },
  },
} as const;

const accentPhraseSchema = {
  properties: {
    moras: {
      elements: moraSchema,
    },
    accent: { type: "int32" },
  },
  optionalProperties: {
    pauseMora: moraSchema,
  },
} as const;

const audioQuerySchema = {
  properties: {
    accentPhrases: {
      elements: accentPhraseSchema,
    },
    speedScale: { type: "float32" },
    pitchScale: { type: "float32" },
    intonationScale: { type: "float32" },
  },
} as const;

const audioItemSchema = {
  properties: {
    text: { type: "string" },
  },
  optionalProperties: {
    characterIndex: { type: "int32" },
    query: audioQuerySchema,
  },
} as const;

export const projectSchema = {
  properties: {
    appVersion: { type: "string" },
    audioKeys: {
      // description: "Attribute keys of audioItems.",
      elements: { type: "string" },
    },
    audioItems: {
      // description: "VOICEVOX states per cell",
      values: audioItemSchema,
    },
  },
} as const;

export type ProjectType = JTDDataType<typeof projectSchema>;

export const version: VersionType = [0, 4, 0];

export const validater = (obj: ProjectBaseType): obj is ProjectType => {
  const ajv = new Ajv();
  const validate = ajv.compile(projectSchema);
  return validate(obj) && obj.audioKeys.every((item) => item in obj.audioItems);
};

export const updater = (obj: PostType): ProjectBaseType => {
  const newObj = JSON.parse(JSON.stringify(obj));
  for (const audioKey of obj.audioKeys) {
    const characterIndex = obj.audioItems[audioKey].charactorIndex;
    delete newObj.audioItems[audioKey].charactorIndex;
    newObj.audioItems[audioKey].characterIndex = characterIndex;
  }
  return newObj as ProjectBaseType;
};
