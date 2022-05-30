import si from "systeminformation";

/**
 * GPUモードがサポートされているかどうか。
 * windowsの場合は全GPUに対応。
 * linuxの場合はNVIDIAのみ対応。
 * なんとなく1GB以上の場合は対応していることにする。
 */
export function hasSupportedGpu(platform: string): Promise<boolean> {
  return si
    .graphics()
    .then((data) =>
      data.controllers.some(
        (datum) =>
          (platform === "win32" ||
            (platform === "linux" &&
              datum.vendor.toUpperCase().indexOf("NVIDIA") !== -1)) &&
          datum.vram >= 1024
      )
    )
    .catch(() => false);
}
