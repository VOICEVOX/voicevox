import { Encoding as EncodingType } from "@/type/preload";
import { AllActions, SaveResultObject } from "@/store/type";
import SaveAllResultDialog from "@/components/SaveAllResultDialog.vue";
import { QVueGlobals } from "quasar";
import { Dispatch } from "@/store/vuex";

type QuasarDialog = QVueGlobals["dialog"];

export async function generateAndSaveOneAudioWithDialog({
  audioKey,
  quasarDialog,
  dispatch,
  filePath,
  encoding,
}: {
  audioKey: string;
  quasarDialog: QuasarDialog;
  dispatch: Dispatch<AllActions>;
  filePath?: string;
  encoding?: EncodingType;
}): Promise<void> {
  const result: SaveResultObject = await dispatch("GENERATE_AND_SAVE_AUDIO", {
    audioKey,
    filePath,
    encoding,
  });
  if (result.result === "SUCCESS" || result.result === "CANCELED") return;
  let msg = "";
  switch (result.result) {
    case "WRITE_ERROR":
      msg =
        "書き込みエラーによって失敗しました。空き容量があることや、書き込み権限があることをご確認ください。";
      break;
    case "ENGINE_ERROR":
      msg =
        "エンジンのエラーによって失敗しました。エンジンの再起動をお試しください。";
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
  dispatch,
  dirPath,
  encoding,
}: {
  quasarDialog: QuasarDialog;
  dispatch: Dispatch<AllActions>;
  dirPath?: string;
  encoding?: EncodingType;
}): Promise<void> {
  const result = await dispatch("GENERATE_AND_SAVE_ALL_AUDIO", {
    dirPath,
    encoding,
  });
  const successArray: Array<string | undefined> = [];
  const writeErrorArray: Array<string | undefined> = [];
  const engineErrorArray: Array<string | undefined> = [];
  if (result) {
    for (const item of result) {
      switch (item.result) {
        case "SUCCESS":
          successArray.push(item.path);
          break;
        case "WRITE_ERROR":
          writeErrorArray.push(item.path);
          break;
        case "ENGINE_ERROR":
          engineErrorArray.push(item.path);
          break;
      }
    }
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
