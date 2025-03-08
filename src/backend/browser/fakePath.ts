import { z } from "zod";
import { uuid4 } from "@/helpers/random";

const fakePathSchema = z
  .string()
  .regex(/^<browser-dummy-[-0-9a-f]+>-.+$/)
  .brand("FakePath");
export type FakePath = z.infer<typeof fakePathSchema>;

export const isFakePath = (path: string): path is FakePath => {
  return fakePathSchema.safeParse(path).success;
};

export const createFakePath = (name: string): FakePath => {
  return fakePathSchema.parse(`<browser-dummy-${uuid4()}>-${name}`);
};
