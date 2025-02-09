import { Dialog, Notify, Loading } from "quasar";
import SaveAllResultDialog from "./SaveAllResultDialog.vue";
import QuestionDialog from "./TextDialog/QuestionDialog.vue";
import MessageDialog from "./TextDialog/MessageDialog.vue";
import { DialogType } from "./TextDialog/common";
import { AudioKey, ConfirmedTips } from "@/type/preload";
import {
  AllActions,
  SaveResultObject,
  SaveResult,
  ErrorTypeForSaveAllResultDialog,
} from "@/store/type";
import { DotNotationDispatch } from "@/store/vuex";
import { withProgress } from "@/store/ui";

type MediaType = "audio" | "text" | "project" | "label";

export type TextDialogResult = "OK" | "CANCEL";
export type MessageDialogOptions = {
  type?: DialogType;
  title: string;
  message: string;
  ok?: string;
};
export type ConfirmDialogOptions = {
  type?: DialogType;
  title: string;
  message: string;
  actionName: string; // ボタンテキスト
  isPrimaryColorButton?: boolean; // ボタンをPrimary色にするか
  cancel?: string;
};
export type WarningDialogOptions = {
  type?: DialogType;
  title: string;
  message: string;
  actionName: string; // ボタンテキスト
  isWarningColorButton?: boolean; // ボタンをWarning色にするか
  cancel?: string;
};
export type QuestionDialogOptions = {
  type?: DialogType;
  title: string;
  message: string;
  buttons: (string | { text: string; color: string })[];
  cancel: number;
  default?: number;
};

export type NotifyAndNotShowAgainButtonOption = {
  message: string;
  isWarning?: boolean;
  icon?: string;
  tipName: keyof ConfirmedTips;
};

// 汎用ダイアログを表示

/** メッセージを知らせるダイアログ */
export const showMessageDialog = async (options: MessageDialogOptions) => {
  options.ok ??= "閉じる";

  const { promise, resolve } = Promise.withResolvers<void>();
  Dialog.create({
    component: MessageDialog,
    componentProps: {
      type: options.type ?? "info",
      title: options.title,
      message: options.message,
      ok: options.ok,
    },
  }).onOk(() => resolve());

  await promise;

  return "OK" as const;
};

/** エラーが起こったことを知らせるダイアログ */
export const showAlertDialog = async (
  options: Omit<MessageDialogOptions, "type">,
) => {
  return await showMessageDialog({
    ...options,
    type: "error",
  });
};

/** 続行することが望まれそうな場合の質問ダイアログ */
export const showConfirmDialog = async (options: ConfirmDialogOptions) => {
  options.cancel ??= "キャンセル";

  const { promise, resolve } = Promise.withResolvers<number>();
  Dialog.create({
    component: QuestionDialog,
    componentProps: {
      type: options.type ?? "question",
      title: options.title,
      message: options.message,
      buttons: [
        options.cancel,
        options.isPrimaryColorButton
          ? { text: options.actionName, color: "primary" }
          : options.actionName,
      ],
      default: 1,
    },
  }).onOk(({ index }: { index: number }) => resolve(index));

  const index = await promise;

  return index === 1 ? "OK" : "CANCEL";
};

/** キャンセルすることが望まれそうな場合の質問ダイアログ */
export const showWarningDialog = async (options: WarningDialogOptions) => {
  options.cancel ??= "キャンセル";

  const { promise, resolve } = Promise.withResolvers<number>();
  Dialog.create({
    component: QuestionDialog,
    componentProps: {
      type: options.type ?? "warning",
      title: options.title,
      message: options.message,
      buttons: [
        options.cancel,
        options.isWarningColorButton
          ? { text: options.actionName, color: "warning" }
          : options.actionName,
      ],
      default: 0,
    },
  }).onOk(({ index }: { index: number }) => resolve(index));

  const index = await promise;

  return index === 1 ? "OK" : "CANCEL";
};

/** キャンセル以外に複数の選択肢がある質問ダイアログ */
export const showQuestionDialog = async (options: QuestionDialogOptions) => {
  const { promise, resolve } = Promise.withResolvers<number>();
  Dialog.create({
    component: QuestionDialog,
    componentProps: {
      type: options.type ?? "question",
      title: options.title,
      message: options.message,
      buttons: options.buttons,
      persistent: options.cancel == undefined,
      default: options.default,
    },
  })
    .onOk(({ index }: { index: number }) => resolve(index))
    .onCancel(() => resolve(options.cancel));

  const index = await promise;

  return index;
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

  if (result == undefined) return;
  notifyResult(result, "audio", actions, disableNotifyOnGenerate);
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

  if (result == undefined) return;
  notifyResult(result, "audio", actions, disableNotifyOnGenerate);
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
  if (!result) return;
  notifyResult(result, "text", actions, disableNotifyOnGenerate);
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
    project: "プロジェクト",
    label: "labファイル",
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

/** 保存結果に応じてユーザーに通知する。キャンセルされた場合は何もしない。 */
export const notifyResult = (
  result: SaveResultObject,
  mediaType: MediaType,
  actions: DotNotationDispatch<AllActions>,
  disableNotifyOnGenerate: boolean,
) => {
  if (result.result === "CANCELED") return;
  if (result.result === "SUCCESS") {
    if (disableNotifyOnGenerate) return;
    showWriteSuccessNotify({
      mediaType,
      actions,
    });
  } else {
    showWriteErrorDialog({ mediaType, result, actions });
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

type LoadingScreenOption = { message: string };

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
