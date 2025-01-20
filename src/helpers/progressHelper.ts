/** 進捗を返すコールバック */
export type ProgressCallback<T extends string | void = void> = [T] extends [
  void,
]
  ? (payload: { progress: number }) => void
  : (payload: { type: T; progress: number }) => void;
