import si from "systeminformation";

interface ISysteminformationGraphicsControllers {
  model: string;
  vendor: string;
  bus: string;
  vram: number;
  vramDynamic: boolean;
}

interface ISysteminformationGraphicsDisplays {
  vendor: string;
  model: string;
  main: boolean;
  builtin: boolean;
  connection: string;
  sizeX: number;
  sizeY: number;
  pixelDepth: number;
  resolutionX: number;
  resolutionY: number;
  currentResX: number;
  currentResY: number;
  positionX: number;
  positionY: number;
  currentRefreshRate: number;
}

interface ISysteminformationGraphics {
  controllers: Array<ISysteminformationGraphicsControllers>;
  displays: Array<ISysteminformationGraphicsDisplays>;
}

export function detectNvidia(): Promise<boolean> {
  return si.graphics().then((data: ISysteminformationGraphics) => {
    return data.controllers.some(
      (a: ISysteminformationGraphicsControllers) =>
        a.vendor.indexOf("NVIDIA") !== -1 && a.vram >= 3072
    )
      ? true
      : false;
  });
}
