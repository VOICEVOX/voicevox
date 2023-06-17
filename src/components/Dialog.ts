import { QVueGlobals } from "quasar";
import {
  AudioKey,
  ConfirmedTips,
  Encoding as EncodingType,
} from "@/type/preload";
import {
  AllActions,
  SaveResultObject,
  ErrorTypeForSaveAllResultDialog,
} from "@/store/type";
import SaveAllResultDialog from "@/components/SaveAllResultDialog.vue";
import { Dispatch } from "@/store/vuex";
import { withProgress } from "@/store/ui";

type QuasarDialog = QVueGlobals["dialog"];
type QuasarNotify = QVueGlobals["notify"];

export async function generateAndSaveOneAudioWithDialog({
  audioKey,
  quasarDialog,
  quasarNotify,
  dispatch,
  filePath,
  encoding,
  confirmedTips,
}: {
  audioKey: AudioKey;
  quasarDialog: QuasarDialog;
  quasarNotify: QuasarNotify;
  dispatch: Dispatch<AllActions>;
  filePath?: string;
  encoding?: EncodingType;
  confirmedTips: ConfirmedTips;
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
    // "今後この通知をしない" 有効時
    if (confirmedTips.notifyOnGenerateAudio) return;

    // 書き出し成功時に通知をする
    quasarNotify({
      message: "音声を書き出しました",
      color: "toast",
      textColor: "toast-display",
      icon: "info",
      timeout: 5000,
      actions: [
        {
          label: "今後この通知をしない",
          textColor: "toast-button-display",
          handler: () => {
            dispatch("SET_CONFIRMED_TIPS", {
              confirmedTips: {
                ...confirmedTips,
                notifyOnGenerateAudio: true,
              },
            });
          },
        },
      ],
    });
    return;
  }

  let msg = "";

  switch (result.result) {
    case "WRITE_ERROR":
      if (result.errorMessage) {
        msg = result.errorMessage;
      } else {
        msg = "何らかの理由で書き出しに失敗しました。ログを参照してください。";
      }
      break;
    case "ENGINE_ERROR":
      if (result.errorMessage) {
        msg = result.errorMessage;
      } else {
        msg =
          "エンジンのエラーによって失敗しました。エンジンの再起動をお試しください。";
      }
      break;
  }
  quasarDialog({
    title: "書き出しに失敗しました。",
    message: msg,
    ok: {
      label: "閉じる",
      flat: true,
      textColor: "secondary",
    },
  });
}

export async function generateAndSaveAllAudioWithDialog({
  quasarDialog,
  quasarNotify,
  dispatch,
  dirPath,
  encoding,
  confirmedTips,
}: {
  quasarDialog: QuasarDialog;
  quasarNotify: QuasarNotify;
  dispatch: Dispatch<AllActions>;
  dirPath?: string;
  encoding?: EncodingType;
  confirmedTips: ConfirmedTips;
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

  const successArray: Array<string | undefined> = [];
  const writeErrorArray: Array<ErrorTypeForSaveAllResultDialog> = [];
  const engineErrorArray: Array<ErrorTypeForSaveAllResultDialog> = [];

  if (result) {
    for (const item of result) {
      let msg = "";
      if (item.errorMessage) {
        msg = item.errorMessage;
      }

      let path = "";
      if (item.path) {
        path = item.path;
      }

      switch (item.result) {
        case "SUCCESS":
          successArray.push(path);
          break;
        case "WRITE_ERROR":
          writeErrorArray.push({ path: path, message: msg });
          break;
        case "ENGINE_ERROR":
          engineErrorArray.push({ path: path, message: msg });
          break;
      }
    }
  }

  if (successArray.length === result?.length) {
    // "今後この通知をしない" 有効時
    if (confirmedTips.notifyOnGenerateAudio) return;

    // 書き出し成功時に通知をする
    quasarNotify({
      message: "音声を書き出しました",
      color: "toast",
      textColor: "toast-display",
      icon: "info",
      timeout: 5000,
      actions: [
        {
          label: "今後この通知をしない",
          textColor: "toast-button-display",
          handler: () => {
            dispatch("SET_CONFIRMED_TIPS", {
              confirmedTips: {
                ...confirmedTips,
                notifyOnGenerateAudio: true,
              },
            });
          },
        },
      ],
    });
  }

  if (writeErrorArray.length > 0 || engineErrorArray.length > 0) {
    quasarDialog({
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
  quasarDialog,
  quasarNotify,
  dispatch,
  filePath,
  encoding,
  confirmedTips,
}: {
  quasarDialog: QuasarDialog;
  quasarNotify: QuasarNotify;
  dispatch: Dispatch<AllActions>;
  filePath?: string;
  encoding?: EncodingType;
  confirmedTips: ConfirmedTips;
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
    // "今後この通知をしない" 有効時
    if (confirmedTips.notifyOnGenerateAudio) return;

    // 書き出し成功時に通知をする
    quasarNotify({
      message: "音声を書き出しました",
      color: "toast",
      textColor: "toast-display",
      icon: "info",
      timeout: 5000,
      actions: [
        {
          label: "今後この通知をしない",
          textColor: "toast-button-display",
          handler: () => {
            dispatch("SET_CONFIRMED_TIPS", {
              confirmedTips: {
                ...confirmedTips,
                notifyOnGenerateAudio: true,
              },
            });
          },
        },
      ],
    });
    return;
  }

  let msg = "";
  switch (result.result) {
    case "WRITE_ERROR":
      if (result.errorMessage != undefined) {
        msg = result.errorMessage;
      } else {
        msg = "何らかの理由で書き出しに失敗しました。ログを参照してください。";
      }
      break;
    case "ENGINE_ERROR":
      if (result.errorMessage != undefined) {
        msg = result.errorMessage;
      } else {
        msg =
          "エンジンのエラーによって失敗しました。エンジンの再起動をお試しください。";
      }
      break;
  }

  quasarDialog({
    title: "書き出しに失敗しました。",
    message: msg,
    ok: {
      label: "閉じる",
      flat: true,
      textColor: "secondary",
    },
  });
}

export async function connectAndExportTextWithDialog({
  quasarDialog,
  quasarNotify,
  dispatch,
  filePath,
  encoding,
  confirmedTips,
}: {
  quasarDialog: QuasarDialog;
  quasarNotify: QuasarNotify;
  dispatch: Dispatch<AllActions>;
  filePath?: string;
  encoding?: EncodingType;
  confirmedTips: ConfirmedTips;
}): Promise<void> {
  const result = await dispatch("CONNECT_AND_EXPORT_TEXT", {
    filePath,
    encoding,
  });

  if (result === undefined || result.result === "CANCELED") return;

  if (result.result === "SUCCESS") {
    // "今後この通知をしない" 有効時
    if (confirmedTips.notifyOnGenerateAudio) return;

    // 書き出し成功時に通知をする
    quasarNotify({
      message: "テキストを書き出しました",
      color: "toast",
      textColor: "toast-display",
      icon: "info",
      timeout: 5000,
      actions: [
        {
          label: "今後この通知をしない",
          textColor: "toast-button-display",
          handler: () => {
            dispatch("SET_CONFIRMED_TIPS", {
              confirmedTips: {
                ...confirmedTips,
                notifyOnGenerateAudio: true,
              },
            });
          },
        },
      ],
    });
    return;
  }

  let msg = "";
  switch (result.result) {
    case "WRITE_ERROR":
      msg =
        "書き込みエラーによって失敗しました。空き容量があることや、書き込み権限があることをご確認ください。";
      break;
  }

  quasarDialog({
    title: "テキストの書き出しに失敗しました。",
    message: msg,
    ok: {
      label: "閉じる",
      flat: true,
      textColor: "secondary",
    },
  });
}
