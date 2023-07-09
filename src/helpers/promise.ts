import { DialogChainObject } from "quasar";

/**
 * QuasarのdialogをPromiseでラップする
 */
export function quasarDialogPromiseWrapper<P>(
  dialogChainObject: DialogChainObject
): Promise<{ payload?: P; on: "ok" | "cancel" | "dismiss" }> {
  return new Promise((resolve) => {
    dialogChainObject
      .onOk((payload: P) => resolve({ payload, on: "ok" }))
      .onCancel(() => resolve({ on: "cancel" }))
      .onDismiss(() => resolve({ on: "dismiss" }));
  });
}
