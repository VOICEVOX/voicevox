import si from "systeminformation";

export function hasSupportedGpu(): Promise<boolean> {
  return si
    .graphics()
    .then((data) =>
      data.controllers.some(
        (datum) =>
          datum.vendor.toUpperCase().indexOf("NVIDIA") !== -1 &&
          datum.vram >= 3072
      )
    )
    .catch(() => false);
}
