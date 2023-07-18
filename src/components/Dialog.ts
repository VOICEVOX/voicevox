import { Dialog, DialogChainObject, Notify } from "quasar";
import { AudioKey, Encoding as EncodingType } from "@/type/preload";
import {
  AllActions,
  SaveResultObject,
  SaveResult,
  ErrorTypeForSaveAllResultDialog,
} from "@/store/type";
import SaveAllResultDialog from "@/components/SaveAllResultDialog.vue";
import { Dispatch } from "@/store/vuex";
import { withProgress } from "@/store/ui";

type MediaType = "audio" | "text";

export type CommonDialogResult = "OK" | "CANCEL";
export type CommonDialogOptions = {
  alert: {
    title: string;
    message: string;
    ok?: string;
  };
  confirm: {
    title: string;
    message: string;
    html?: boolean;
    actionName: string;
    cancel?: string;
  };
  warning: {
    title: string;
    message: string;
    actionName: string;
    cancel?: string;
  };
};
export type CommonDialogType = keyof CommonDialogOptions;
type CommonDialogCallback = (
  value: CommonDialogResult | PromiseLike<CommonDialogResult>
) => void;

// 汎用ダイアログを表示
export const showAlertDialog = async (
  options: CommonDialogOptions["alert"]
) => {
  options.ok ??= "閉じる";

  return new Promise((resolve: CommonDialogCallback) => {
    setCommonDialogCallback(
      Dialog.create({
        title: options.title,
        message: options.message,
        ok: {
          label: options.ok,
          flat: true,
          textColor: "display",
        },
      }),
      resolve
    );
  });
};

/**
 * htmlフラグを`true`にする場合、外部からの汚染された文字列を`title`や`message`に含めてはいけません。
 * see https://quasar.dev/quasar-plugins/dialog#using-html
 */
export const showConfirmDialog = async (
  options: CommonDialogOptions["confirm"]
) => {
  options.cancel ??= "キャンセル";

  return new Promise((resolve: CommonDialogCallback) => {
    setCommonDialogCallback(
      Dialog.create({
        title: options.title,
        message: options.message,
        persistent: true, // ダイアログ外側押下時・Esc押下時にユーザが設定ができたと思い込むことを防止する
        focus: "cancel",
        html: options.html,
        ok: {
          flat: true,
          label: options.actionName,
          textColor: "display",
        },
        cancel: {
          flat: true,
          label: options.cancel,
          textColor: "display",
        },
      }),
      resolve
    );
  });
};

export const showWarningDialog = async (
  options: CommonDialogOptions["warning"]
) => {
  options.cancel ??= "キャンセル";

  return new Promise((resolve: CommonDialogCallback) => {
    setCommonDialogCallback(
      Dialog.create({
        title: options.title,
        message: options.message,
        persistent: true,
        focus: "cancel",
        ok: {
          label: options.actionName,
          flat: true,
          textColor: "warning",
        },
        cancel: {
          label: options.cancel,
          flat: true,
          textColor: "display",
        },
      }),
      resolve
    );
  });
};

const setCommonDialogCallback = (
  dialog: DialogChainObject,
  resolve: (result: CommonDialogResult) => void
) => {
  return dialog
    .onOk(() => {
      resolve("OK");
    })
    .onCancel(() => {
      resolve("CANCEL");
    });
};

export async function generateAndSaveOneAudioWithDialog({
  audioKey,
  dispatch,
  filePath,
  encoding,
  disableNotifyOnGenerate,
}: {
  audioKey: AudioKey;
  dispatch: Dispatch<AllActions>;
  filePath?: string;
  encoding?: EncodingType;
  disableNotifyOnGenerate: boolean;
}): Promise<void> {
  const result: SaveResultObject = await withProgress(
    dispatch("GENERATE_AND_SAVE_AUDIO", {
      audioKey,
      filePath,
      encoding,
    }),
    dispatch
  );

  if (result.result === "CANCELED") return;

  if (result.result === "SUCCESS") {
    if (disableNotifyOnGenerate) return;
    // 書き出し成功時に通知をする
    showWriteSuccessNotify({
      mediaType: "audio",
      dispatch,
    });
  } else {
    showWriteErrorDialog({ mediaType: "audio", result });
  }
}

export async function generateAndSaveAllAudioWithDialog({
  dispatch,
  dirPath,
  encoding,
  disableNotifyOnGenerate,
}: {
  dispatch: Dispatch<AllActions>;
  dirPath?: string;
  encoding?: EncodingType;
  disableNotifyOnGenerate: boolean;
}): Promise<void> {
  const result = await withProgress(
    dispatch("GENERATE_AND_SAVE_ALL_AUDIO", {
      dirPath,
      encoding,
      callback: (finishedCount, totalCount) =>
        dispatch("SET_PROGRESS_FROM_COUNT", { finishedCount, totalCount }),
    }),
    dispatch
  );

  if (result === undefined) return;

  // 書き出し成功時の出力先パスを配列に格納
  const successArray: Array<string | undefined> = result.flatMap((result) =>
    result.result === "SUCCESS" ? result.path : []
  );

  // 書き込みエラーを配列に格納
  const writeErrorArray: Array<ErrorTypeForSaveAllResultDialog> =
    result.flatMap((result) =>
      result.result === "WRITE_ERROR"
        ? { path: result.path ?? "", message: result.errorMessage ?? "" }
        : []
    );

  // エンジンエラーを配列に格納
  const engineErrorArray: Array<ErrorTypeForSaveAllResultDialog> =
    result.flatMap((result) =>
      result.result === "ENGINE_ERROR"
        ? { path: result.path ?? "", message: result.errorMessage ?? "" }
        : []
    );

  if (successArray.length === result.length) {
    if (disableNotifyOnGenerate) return;
    // 書き出し成功時に通知をする
    showWriteSuccessNotify({
      mediaType: "audio",
      dispatch,
    });
  }

  if (writeErrorArray.length > 0 || engineErrorArray.length > 0) {
    Dialog.create({
      component: SaveAllResultDialog,
      componentProps: {
        successArray: successArray,
        writeErrorArray: writeErrorArray,
        engineErrorArray: engineErrorArray,
      },
    });
  }
}

export async function generateAndConnectAndSaveAudioWithDialog({
  dispatch,
  filePath,
  encoding,
  disableNotifyOnGenerate,
}: {
  dispatch: Dispatch<AllActions>;
  filePath?: string;
  encoding?: EncodingType;
  disableNotifyOnGenerate: boolean;
}): Promise<void> {
  const result = await withProgress(
    dispatch("GENERATE_AND_CONNECT_AND_SAVE_AUDIO", {
      filePath,
      encoding,
      callback: (finishedCount, totalCount) =>
        dispatch("SET_PROGRESS_FROM_COUNT", { finishedCount, totalCount }),
    }),
    dispatch
  );

  if (result === undefined || result.result === "CANCELED") return;

  if (result.result === "SUCCESS") {
    if (disableNotifyOnGenerate) return;
    showWriteSuccessNotify({
      mediaType: "audio",
      dispatch,
    });
  } else {
    showWriteErrorDialog({ mediaType: "audio", result });
  }
}

export async function connectAndExportTextWithDialog({
  dispatch,
  filePath,
  encoding,
  disableNotifyOnGenerate,
}: {
  dispatch: Dispatch<AllActions>;
  filePath?: string;
  encoding?: EncodingType;
  disableNotifyOnGenerate: boolean;
}): Promise<void> {
  const result = await dispatch("CONNECT_AND_EXPORT_TEXT", {
    filePath,
    encoding,
  });

  if (result === undefined || result.result === "CANCELED") return;

  if (result.result === "SUCCESS") {
    if (disableNotifyOnGenerate) return;
    showWriteSuccessNotify({
      mediaType: "text",
      dispatch,
    });
  } else {
    showWriteErrorDialog({ mediaType: "text", result });
  }
}

// 書き出し成功時の通知を表示
const showWriteSuccessNotify = ({
  mediaType,
  dispatch,
}: {
  mediaType: MediaType;
  dispatch: Dispatch<AllActions>;
}): void => {
  const mediaTypeNames: Record<MediaType, string> = {
    audio: "音声",
    text: "テキスト",
  };

  Notify.create({
    message: `${mediaTypeNames[mediaType]}を書き出しました`,
    color: "toast",
    textColor: "toast-display",
    icon: "info",
    timeout: 5000,
    actions: [
      {
        label: "今後この通知をしない",
        textColor: "toast-button-display",
        handler: () => {
          dispatch("SET_CONFIRMED_TIP", {
            confirmedTip: {
              notifyOnGenerate: true,
            },
          });
        },
      },
    ],
  });
};

// 書き出し失敗時のダイアログを表示
const showWriteErrorDialog = ({
  mediaType,
  result,
}: {
  mediaType: MediaType;
  result: SaveResultObject;
}) => {
  if (mediaType === "text") {
    // テキスト書き出し時のエラーを出力
    showAlertDialog({
      title: "テキストの書き出しに失敗しました。",
      message:
        "書き込みエラーによって失敗しました。空き容量があることや、書き込み権限があることをご確認ください。",
    });
  } else {
    const defaultErrorMessages: Partial<Record<SaveResult, string>> = {
      WRITE_ERROR:
        "何らかの理由で書き出しに失敗しました。ログを参照してください。",
      ENGINE_ERROR:
        "エンジンのエラーによって失敗しました。エンジンの再起動をお試しください。",
      UNKNOWN_ERROR:
        "何らかの理由で書き出しに失敗しました。ログを参照してください。",
    };

    // 音声書き出し時のエラーを出力
    showAlertDialog({
      title: "書き出しに失敗しました。",
      message: result.errorMessage ?? defaultErrorMessages[result.result] ?? "",
    });
  }
};
