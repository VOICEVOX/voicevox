import { z } from "zod";
import type { UpdateInfo } from "@/type/preload";

const ossLicenseInfoSchema = z.object({
  name: z.string(),
  version: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  text: z.string(),
});

export type OssLicenseInfo = z.infer<typeof ossLicenseInfoSchema>;

const loadDefault = async <T>(
  loader: () => Promise<{ default: T }>,
): Promise<T> => {
  const module = await loader();
  return module.default;
};

export const loadHowToUseText = async (): Promise<string> => {
  return await loadDefault(() => import("../../public/howtouse.md?raw"));
};

export const loadContactText = async (): Promise<string> => {
  return await loadDefault(() => import("../../public/contact.md?raw"));
};

export const loadQAndAText = async (): Promise<string> => {
  return await loadDefault(() => import("../../public/qAndA.md?raw"));
};

export const loadPolicyText = async (): Promise<string> => {
  return await loadDefault(() => import("../../public/policy.md?raw"));
};

export const loadOssLicenses = async (): Promise<OssLicenseInfo[]> => {
  return ossLicenseInfoSchema
    .array()
    .parse(await loadDefault(() => import("../../public/licenses.json")));
};

export const loadUpdateInfos = async (): Promise<UpdateInfo[]> => {
  return await loadDefault(() => import("../../public/updateInfos.json"));
};

export const loadOssCommunityInfos = async (): Promise<string> => {
  return await loadDefault(
    () => import("../../public/ossCommunityInfos.md?raw"),
  );
};

export const loadPrivacyPolicyText = async (): Promise<string> => {
  return await loadDefault(() => import("../../public/privacyPolicy.md?raw"));
};
