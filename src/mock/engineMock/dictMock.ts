/**
 * 辞書のモック。
 * 辞書クラス内で辞書を単語を管理し、API用の関数を払い出す。
 */

import { uuid4 } from "@/helpers/random";
import {
  AddUserDictWordUserDictWordPostRequest,
  DefaultApiInterface,
  DeleteUserDictWordUserDictWordWordUuidDeleteRequest,
  RewriteUserDictWordUserDictWordWordUuidPutRequest,
  UserDictWord,
} from "@/openapi";
import { Brand } from "@/type/utility";

type UserDictWordId = Brand<string, "UserDictWordId">;

/** 単語追加リクエストで送られる断片的な単語情報からUserDictWordを作成する */
function createWord(
  wordProperty: AddUserDictWordUserDictWordPostRequest,
): UserDictWord {
  return {
    surface: wordProperty.surface,
    pronunciation: wordProperty.pronunciation,
    accentType: wordProperty.accentType,
    partOfSpeech: "名詞",
    partOfSpeechDetail1: "一般",
    partOfSpeechDetail2: "*",
    partOfSpeechDetail3: "*",
    inflectionalType: "*",
    inflectionalForm: "*",
    stem: "*",
    yomi: wordProperty.pronunciation,
    priority: wordProperty.priority ?? 5,
    accentAssociativeRule: "*",
  };
}

/**
 * 辞書のモックを作成するクラス。
 */
export class DictMock {
  private userDictWords: Map<UserDictWordId, UserDictWord>;

  constructor() {
    this.userDictWords = new Map();
  }

  /**
   * テキストに対して辞書を適用する。
   * 単純なテキスト置換を行う。
   */
  applyDict(text: string): string {
    for (const word of this.userDictWords.values()) {
      text = text.replace(new RegExp(word.surface, "g"), word.pronunciation);
    }
    return text;
  }

  /** 辞書系のOpenAPIの関数を返す */
  createDictMockApi(): Pick<
    DefaultApiInterface,
    | "getUserDictWordsUserDictGet"
    | "addUserDictWordUserDictWordPost"
    | "rewriteUserDictWordUserDictWordWordUuidPut"
    | "deleteUserDictWordUserDictWordWordUuidDelete"
  > {
    return {
      getUserDictWordsUserDictGet: async (): Promise<{
        [key: UserDictWordId]: UserDictWord;
      }> => {
        return Object.fromEntries(this.userDictWords.entries());
      },

      addUserDictWordUserDictWordPost: async (
        payload: AddUserDictWordUserDictWordPostRequest,
      ) => {
        const id = uuid4() as UserDictWordId;
        const word = createWord(payload);
        this.userDictWords.set(id, word);
        return id;
      },

      rewriteUserDictWordUserDictWordWordUuidPut: async (
        payload: RewriteUserDictWordUserDictWordWordUuidPutRequest,
      ) => {
        const word = createWord(payload);
        this.userDictWords.set(payload.wordUuid as UserDictWordId, word);
      },

      deleteUserDictWordUserDictWordWordUuidDelete: async (
        payload: DeleteUserDictWordUserDictWordWordUuidDeleteRequest,
      ) => {
        this.userDictWords.delete(payload.wordUuid as UserDictWordId);
      },
    };
  }
}
