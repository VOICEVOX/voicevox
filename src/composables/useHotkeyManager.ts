import { HotkeySettingType } from "@/type/preload";

let hotkeyManager: HotkeyManager | undefined = undefined;
export const useHotkeyManager = () => {
  if (!hotkeyManager) {
    hotkeyManager = new HotkeyManager();
  }
  return hotkeyManager;
};

export class HotkeyManager {
  load(data: HotkeySettingType[]): void {
    throw new Error("unimplemented");
  }

  refresh(): void {
    throw new Error("unimplemented");
  }

  replace(data: HotkeySettingType): void {
    throw new Error("unimplemented");
  }

  register(data: {
    when: "talk" | "sing";
    enableInTextbox: boolean;
    name: string;
    action: () => void;
  }): void {
    throw new Error("unimplemented");
  }
}
