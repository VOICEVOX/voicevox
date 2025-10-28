import { app } from "electron";

// hasSupportedGpuで使用する最小限のGPUInfo
type MinimumGPUInfo = {
  gpuDevice: { vendorId: number }[];
};

const microsoftVendorId = 0x1414;
const nvidiaVendorId = 0x10de;

/**
 * GPUモードがサポートされているかどうか。
 * windowsの場合は全GPUに対応。
 * linuxの場合はNVIDIAのみ対応。
 */
export async function hasSupportedGpu(platform: string): Promise<boolean> {
  return app
    .getGPUInfo("basic")
    .then((GPUInfo) => {
      const info = GPUInfo as MinimumGPUInfo;
      if (platform === "win32") {
        // Microsoft Basic Render Driverは除外する
        return info.gpuDevice.some(
          (device) => device.vendorId !== microsoftVendorId,
        );
      } else if (platform === "linux") {
        return info.gpuDevice.some(
          (device) => device.vendorId === nvidiaVendorId,
        );
      }
      return false;
    })
    .catch(() => false);
}
