import { StoreDefinition } from "pinia";
import type { DeepReadonly } from "ts-essentials";

type ToReadonlyStoreDefinition<SD> = SD extends StoreDefinition<
  infer Id,
  infer S,
  infer G,
  infer A
>
  ? StoreDefinition<Id, DeepReadonly<S>, G, A>
  : SD;

export function toReadonlyStoreDefinition<SD>(useStore: SD) {
  return useStore as ToReadonlyStoreDefinition<SD>;
}
