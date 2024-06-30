import kuromoji, { IpadicFeatures, Tokenizer } from "kuromoji";
import { tokensToActtentPhrases } from "./talkModelMock";
import { IEngineConnectorFactory } from "@/infrastructures/EngineConnector";
import {
  AccentPhrase,
  AccentPhrasesAccentPhrasesPostRequest,
  DefaultApiInterface,
  Mora,
} from "@/openapi";
import { moraPattern } from "@/domain/japanese";

export const dicPath = "/kuromoji/dict";

export const mockHost = "mock";

export function createOpenAPIEngineMock(): IEngineConnectorFactory {
  let mockApi: Partial<DefaultApiInterface> | undefined = undefined;
  return {
    instance: (host: string) => {
      if (host !== mockHost) {
        throw new Error(`Invalid host: ${host}`);
      }

      if (mockApi == undefined) {
        // テキスト形態素解析器
        const tokenizerPromise = new Promise<Tokenizer<IpadicFeatures>>(
          (resolve, reject) => {
            kuromoji
              .builder({
                dicPath,
              })
              .build(function (err, tokenizer) {
                if (err) {
                  reject(err);
                } else {
                  resolve(tokenizer);
                }
              });
          },
        );

        mockApi = {
          async accentPhrasesAccentPhrasesPost(
            payload: AccentPhrasesAccentPhrasesPostRequest,
          ): Promise<AccentPhrase[]> {
            if (payload.isKana == true)
              throw new Error("AquesTalk風記法は未対応です");

            const tokenizer = await tokenizerPromise;
            const tokens = tokenizer.tokenize(payload.text);
            const accentPhrases = tokensToActtentPhrases(tokens);

            // 話者ごとに同じにならないように適当にずらす
            const speaker = payload.speaker;
            const diff = speaker * 0.03;
            for (const accentPhrase of accentPhrases) {
              for (const mora of accentPhrase.moras) {
                if (mora.consonantLength != undefined)
                  mora.consonantLength += diff;
                mora.vowelLength += diff;
                if (mora.pitch > 0) mora.pitch += diff;
              }
              if (accentPhrase.pauseMora != undefined) {
                accentPhrase.pauseMora.vowelLength += diff;
              }
            }

            return accentPhrases;
          },
        };
      }

      return mockApi as DefaultApiInterface;
    },
  };
}
