import { createLogger } from "@/helpers/log";

const log = createLogger("WelcomeScreenController");

export class WelcomeScreenController {
}

let manager: WelcomeScreenController | undefined;

export function getWelcomeScreenController() {
  if (manager == undefined) {
    manager = new WelcomeScreenController();
  }
  return manager;
}
