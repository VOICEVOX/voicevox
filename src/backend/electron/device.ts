import { app } from "electron";

// hasSupportedGpuで使用する最小限のGPUInfo
type MinimumGPUInfo = {
  gpuDevice: { vendorId: number }[];
};

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
        // VendorID 0x1414はMicrosoft Basic Render Driverなので除外する
        return info.gpuDevice.some((device) => device.vendorId !== 0x1414);
      } else if (platform === "linux") {
        return info.gpuDevice.some((device) => device.vendorId === 0x10de);
      }
      return false;
    })
    .catch(() => false);
}
