import Ajv from "ajv";
import { JTDDataType } from "ajv/dist/jtd";
import { ProjectBaseType } from ".";

const moraSchema = {
  properties: {
    text: { type: "string" },
    vowel: { type: "string" },
    pitch: { type: "int32" },
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
    speedScale: { type: "int32" },
    pitchScale: { type: "int32" },
    intonationScale: { type: "int32" },
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

const projectSchema = {
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

export const version: [number, number, number] = [0, 3, 0];

export const validater = (obj: ProjectBaseType): obj is ProjectType => {
  const ajv = new Ajv({ strict: false });
  const validate = ajv.compile(projectSchema);
  return validate(obj) && obj.audioKeys.every((item) => item in obj.audioItems);
};
