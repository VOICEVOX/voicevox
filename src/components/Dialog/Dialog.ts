import { Dialog, Notify, Loading } from "quasar";
import SaveAllResultDialog from "./SaveAllResultDialog.vue";
import QuestionDialog from "./TextDialog/QuestionDialog.vue";
import MessageDialog from "./TextDialog/MessageDialog.vue";
import { AudioKey, ConfirmedTips } from "@/type/preload";
import {
  AllActions,
  SaveResultObject,
  SaveResult,
  ErrorTypeForSaveAllResultDialog,
} from "@/store/type";
import { DotNotationDispatch } from "@/store/vuex";
import { withProgressDotNotation as withProgress } from "@/store/ui";

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

export type NotifyAndNotShowAgainButtonOption = {
  message: string;
  isWarning?: boolean;
  icon?: string;
  tipName: keyof ConfirmedTips;
};

export type LoadingScreenOption = { message: string };

// 汎用ダイアログを表示
export const showAlertDialog = async (
  options: CommonDialogOptions["alert"],
) => {
  options.ok ??= "閉じる";

  const { promise, resolve } = Promise.withResolvers<void>();
  Dialog.create({
    component: MessageDialog,
    componentProps: {
      type: "warning",
      title: options.title,
      message: options.message,
      ok: options.ok,
    },
  }).onOk(() => resolve());

  await promise;

  return "OK" as const;
};

/**
 * htmlフラグを`true`にする場合、外部からの汚染された文字列を`title`や`message`に含めてはいけません。
 * see https://quasar.dev/quasar-plugins/dialog#using-html
 */
export const showConfirmDialog = async (
  options: CommonDialogOptions["confirm"],
) => {
  options.cancel ??= "キャンセル";

  const { promise, resolve } = Promise.withResolvers<number>();
  Dialog.create({
    component: QuestionDialog,
    componentProps: {
      type: "question",
      title: options.title,
      message: options.message,
      buttons: [options.actionName, options.cancel],
      default: 0,
    },
  }).onOk(({ index }: { index: number }) => resolve(index));

  const index = await promise;

  return index === 0 ? "OK" : "CANCEL";
};

export const showWarningDialog = async (
  options: CommonDialogOptions["warning"],
) => {
  options.cancel ??= "キャンセル";

  const { promise, resolve } = Promise.withResolvers<number>();
  Dialog.create({
    component: QuestionDialog,
    componentProps: {
      type: "warning",
      title: options.title,
      message: options.message,
      buttons: [options.actionName, options.cancel],
      default: 1,
    },
  }).onOk(({ index }: { index: number }) => resolve(index));

  const index = await promise;

  return index === 0 ? "OK" : "CANCEL";
};

export async function generateAndSaveOneAudioWithDialog({
  audioKey,
  actions,
  filePath,
  disableNotifyOnGenerate,
}: {
  audioKey: AudioKey;
  actions: DotNotationDispatch<AllActions>;
  filePath?: string;
  disableNotifyOnGenerate: boolean;
}): Promise<void> {
  const result: SaveResultObject = await withProgress(
    actions.GENERATE_AND_SAVE_AUDIO({
      audioKey,
      filePath,
    }),
    actions,
  );

  if (result.result === "CANCELED") return;

  if (result.result === "SUCCESS") {
    if (disableNotifyOnGenerate) return;
    // 書き出し成功時に通知をする
    showWriteSuccessNotify({
      mediaType: "audio",
      actions,
    });
  } else {
    showWriteErrorDialog({ mediaType: "audio", result, actions });
  }
}

export async function multiGenerateAndSaveAudioWithDialog({
  audioKeys,
  actions,
  dirPath,
  disableNotifyOnGenerate,
}: {
  audioKeys: AudioKey[];
  actions: DotNotationDispatch<AllActions>;
  dirPath?: string;
  disableNotifyOnGenerate: boolean;
}): Promise<void> {
  const result = await withProgress(
    actions.MULTI_GENERATE_AND_SAVE_AUDIO({
      audioKeys,
      dirPath,
      callback: (finishedCount) =>
        actions.SET_PROGRESS_FROM_COUNT({
          finishedCount,
          totalCount: audioKeys.length,
        }),
    }),
    actions,
  );

  if (result == undefined) return;

  // 書き出し成功時の出力先パスを配列に格納
  const successArray: (string | undefined)[] = result.flatMap((result) =>
    result.result === "SUCCESS" ? result.path : [],
  );

  // 書き込みエラーを配列に格納
  const writeErrorArray: ErrorTypeForSaveAllResultDialog[] = result.flatMap(
    (result) =>
      result.result === "WRITE_ERROR"
        ? { path: result.path ?? "", message: result.errorMessage ?? "" }
        : [],
  );

  // エンジンエラーを配列に格納
  const engineErrorArray: ErrorTypeForSaveAllResultDialog[] = result.flatMap(
    (result) =>
      result.result === "ENGINE_ERROR"
        ? { path: result.path ?? "", message: result.errorMessage ?? "" }
        : [],
  );

  if (successArray.length === result.length) {
    if (disableNotifyOnGenerate) return;
    // 書き出し成功時に通知をする
    showWriteSuccessNotify({
      mediaType: "audio",
      actions,
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
  actions,
  filePath,
  disableNotifyOnGenerate,
}: {
  actions: DotNotationDispatch<AllActions>;
  filePath?: string;
  disableNotifyOnGenerate: boolean;
}): Promise<void> {
  const result = await withProgress(
    actions.GENERATE_AND_CONNECT_AND_SAVE_AUDIO({
      filePath,
      callback: (finishedCount, totalCount) =>
        actions.SET_PROGRESS_FROM_COUNT({ finishedCount, totalCount }),
    }),
    actions,
  );

  if (result == undefined || result.result === "CANCELED") return;

  if (result.result === "SUCCESS") {
    if (disableNotifyOnGenerate) return;
    showWriteSuccessNotify({
      mediaType: "audio",
      actions,
    });
  } else {
    showWriteErrorDialog({ mediaType: "audio", result, actions });
  }
}

export async function connectAndExportTextWithDialog({
  actions,
  filePath,
  disableNotifyOnGenerate,
}: {
  actions: DotNotationDispatch<AllActions>;
  filePath?: string;
  disableNotifyOnGenerate: boolean;
}): Promise<void> {
  const result = await actions.CONNECT_AND_EXPORT_TEXT({
    filePath,
  });

  if (result == undefined || result.result === "CANCELED") return;

  if (result.result === "SUCCESS") {
    if (disableNotifyOnGenerate) return;
    showWriteSuccessNotify({
      mediaType: "text",
      actions,
    });
  } else {
    showWriteErrorDialog({ mediaType: "text", result, actions });
  }
}

// 書き出し成功時の通知を表示
const showWriteSuccessNotify = ({
  mediaType,
  actions,
}: {
  mediaType: MediaType;
  actions: DotNotationDispatch<AllActions>;
}): void => {
  const mediaTypeNames: Record<MediaType, string> = {
    audio: "音声",
    text: "テキスト",
  };
  void actions.SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON({
    message: `${mediaTypeNames[mediaType]}を書き出しました`,
    tipName: "notifyOnGenerate",
  });
};

// 書き出し失敗時のダイアログを表示
const showWriteErrorDialog = ({
  mediaType,
  result,
  actions,
}: {
  mediaType: MediaType;
  result: SaveResultObject;
  actions: DotNotationDispatch<AllActions>;
}) => {
  if (mediaType === "text") {
    // テキスト書き出し時のエラーを出力
    void actions.SHOW_ALERT_DIALOG({
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
    void actions.SHOW_ALERT_DIALOG({
      title: "書き出しに失敗しました。",
      message: result.errorMessage ?? defaultErrorMessages[result.result] ?? "",
    });
  }
};

const NOTIFY_TIMEOUT = 7000;

export const showNotifyAndNotShowAgainButton = (
  {
    actions,
  }: {
    actions: DotNotationDispatch<AllActions>;
  },
  options: NotifyAndNotShowAgainButtonOption,
) => {
  options.icon ??= options.isWarning ? "warning" : "info";

  const suffix = options.isWarning ? "-warning" : "";
  Notify.create({
    message: options.message,
    color: "toast" + suffix,
    textColor: "toast-display" + suffix,
    icon: options.isWarning ? "warning" : "info",
    timeout: NOTIFY_TIMEOUT,
    actions: [
      {
        label: "今後このメッセージを表示しない",
        textColor: "toast-button-display" + suffix,
        handler: () => {
          void actions.SET_CONFIRMED_TIP({
            confirmedTip: {
              [options.tipName]: true,
            },
          });
        },
      },
      {
        label: "閉じる",
        color: "toast-button-display" + suffix,
      },
    ],
  });
};

export const showLoadingScreen = (options: LoadingScreenOption) => {
  Loading.show({
    spinnerColor: "primary",
    spinnerSize: 50,
    boxClass: "bg-background text-display",
    message: options.message,
  });
};

export const hideAllLoadingScreen = () => {
  Loading.hide();
};
