import type { IpcIHData } from "@/type/ipc";
import {
  ContactTextFileName,
  HowToUseTextFileName,
  OssCommunityInfosFileName,
  OssLicensesJsonFileName,
  PolicyTextFileName,
  PrivacyPolicyTextFileName,
  QAndATextFileName,
  UpdateInfosJsonFileName,
} from "@/type/staticResources";

type SandboxImpl = {
  [K in keyof IpcIHData]: (
    args: IpcIHData[K]["args"]
  ) => Promise<IpcIHData[K]["return"]>;
};

export const getAppInfosImpl: SandboxImpl["GET_APP_INFOS"] = () => {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const appInfo = {
    name: process.env.APP_NAME!,
    version: process.env.APP_VERSION!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
  return Promise.resolve(appInfo);
};

// TODO: base pathを設定できるようにするか、ビルド時埋め込みにする
const toStaticPath = (fileName: string) => `/${fileName}`;

export const getHowToUseTextImpl: SandboxImpl["GET_HOW_TO_USE_TEXT"] = () => {
  return fetch(toStaticPath(HowToUseTextFileName)).then((v) => v.text());
};

export const getPolicyTextImpl: SandboxImpl["GET_POLICY_TEXT"] = () => {
  return fetch(toStaticPath(PolicyTextFileName)).then((v) => v.text());
};

export const getOssCommunityInfosImpl: SandboxImpl["GET_OSS_COMMUNITY_INFOS"] =
  () => {
    return fetch(toStaticPath(OssCommunityInfosFileName)).then((v) => v.text());
  };

export const getContactTextImpl: SandboxImpl["GET_CONTACT_TEXT"] = () => {
  return fetch(toStaticPath(ContactTextFileName)).then((v) => v.text());
};

export const getQAndATextImpl: SandboxImpl["GET_Q_AND_A_TEXT"] = () => {
  return fetch(toStaticPath(QAndATextFileName)).then((v) => v.text());
};

export const getPrivacyPolicyTextImpl: SandboxImpl["GET_PRIVACY_POLICY_TEXT"] =
  () => {
    return fetch(toStaticPath(PrivacyPolicyTextFileName)).then((v) => v.text());
  };

export const getOssLicensesImpl: SandboxImpl["GET_OSS_LICENSES"] = () => {
  return fetch(toStaticPath(OssLicensesJsonFileName)).then((v) => v.json());
};

export const getUpdateInfosImpl: SandboxImpl["GET_UPDATE_INFOS"] = () => {
  return fetch(toStaticPath(UpdateInfosJsonFileName)).then((v) => v.json());
};
