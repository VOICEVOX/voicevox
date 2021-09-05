// https://o296.com/2021/01/13/typescript-result-type.html
const OkMarker = "OkMarker";
const NgMarker = "NgMarker";

export type Ok<T> = { value: T; _: typeof OkMarker };
export type Err<E> = { value: E; _: typeof NgMarker };
export type Result<T, E> = Ok<T> | Err<E>;

export function toOk<T>(value: T): Ok<T> {
  return { value, _: OkMarker };
}

export function toErr<E>(value: E): Err<E> {
  return { value, _: NgMarker };
}

export function isOk<T, E>(a: Result<T, E>): a is Ok<T> {
  return a._ === OkMarker;
}
