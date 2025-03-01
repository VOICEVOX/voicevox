<template>
  <Presentation
    :valueChanges
    :contextMenuData
    :contextMenuHeader
    :width
    :offset
    :uiLocked
    @valueChangeClick="onValueChangeClick"
    @contextMenuHide="onContextMenuHide"
  />
</template>

<script setup lang="ts">
import { computed, ref, inject } from "vue";
import { Dialog } from "quasar";
import { sequencerRulerInjectionKey } from "../Container.vue";
import Presentation from "./Presentation.vue";
import { tickToMeasureNumber } from "@/sing/domain";
import { Tempo, TimeSignature } from "@/store/type";
import { ContextMenuItemData } from "@/components/Menu/ContextMenu/Presentation.vue";
import TempoChangeDialog from "@/components/Sing/ChangeValueDialog/TempoChangeDialog.vue";
import TimeSignatureChangeDialog from "@/components/Sing/ChangeValueDialog/TimeSignatureChangeDialog.vue";

export type ValueChange = {
  position: number;
  text: string;
  tempoChange: Tempo | undefined;
  timeSignatureChange: TimeSignature | undefined;
  x: number;
};

defineOptions({
  name: "ValueChangesLaneContainer",
});

const emit = defineEmits<{
  setPlayheadPosition: [position: number];
}>();

const injectedValue = inject(sequencerRulerInjectionKey);
if (injectedValue == undefined) {
  throw new Error("injectedValue is undefined.");
}

const {
  tsPositions,
  width,
  endTicks,
  tpqn,
  timeSignatures,
  offset,
  uiLocked,
  tempos,
  setTempo,
  removeTempo,
  setTimeSignature,
  removeTimeSignature,
  offsetXToSnappedTick,
  playheadTicks,
} = injectedValue;

const valueChange = ref<ValueChange | null>(null);

const valueChanges = computed<ValueChange[]>(() => {
  const timeSignaturesWithTicks = tsPositions.value.map((tsPosition, i) => ({
    type: "timeSignature" as const,
    position: tsPosition,
    timeSignature: timeSignatures.value[i],
  }));
  const valueChangeTempos = tempos.value.map((tempo) => {
    return {
      type: "tempo" as const,
      position: tempo.position,
      tempo,
    };
  });

  return [
    ...Map.groupBy(
      [...valueChangeTempos, ...timeSignaturesWithTicks],
      (item) => item.position,
    ).entries(),
  ]
    .toSorted((a, b) => a[0] - b[0])
    .map(([tick, items]) => {
      const tempo = items.find((item) => item.type === "tempo")?.tempo;
      const timeSignature = items.find(
        (item) => item.type === "timeSignature",
      )?.timeSignature;

      const tempoText = tempo?.bpm ?? "";
      const timeSignatureText = timeSignature
        ? `${timeSignature.beats}/${timeSignature.beatType}`
        : "";

      const text = [tempoText, timeSignatureText].filter(Boolean).join(" ");

      return {
        position: tick,
        text,
        tempoChange: tempo,
        timeSignatureChange: timeSignature,
        x: (width.value / endTicks.value) * tick,
      };
    });
});

const onValueChangeClick = async (
  event: MouseEvent,
  newValueChange: ValueChange | null,
) => {
  if (uiLocked.value) return;

  // 再生位置を変更
  if (newValueChange) {
    // テキストクリック時は、そのvalueChangeの位置へ移動
    emit("setPlayheadPosition", newValueChange.position);
  } else {
    // 空き部分クリック時は、クリック位置から計算してスナップ位置に合わせる
    const snappedTick = offsetXToSnappedTick(event.offsetX);
    emit("setPlayheadPosition", snappedTick);
  }
  valueChange.value = newValueChange;
};

const onContextMenuHide = () => {
  valueChange.value = null;
};

const contextMenuData = computed<ContextMenuItemData[]>(() => {
  const menuData: ContextMenuItemData[] = [];

  if (valueChange.value) {
    // テンポ変更のメニュー項目
    if (valueChange.value.tempoChange) {
      menuData.push({
        type: "button",
        label: "テンポ変化を編集",
        onClick: () => {
          Dialog.create({
            component: TempoChangeDialog,
            componentProps: {
              tempoChange: valueChange.value!.tempoChange,
              mode: "edit",
            },
          }).onOk((result: { tempoChange: Omit<Tempo, "position"> }) => {
            setTempo({
              ...result.tempoChange,
              position: valueChange.value!.position,
            });
          });
        },
        disableWhenUiLocked: true,
      });

      menuData.push({
        type: "button",
        label: "テンポ変化を削除",
        disabled: valueChange.value.position === 0,
        onClick: () => {
          removeTempo(valueChange.value!.position);
        },
        disableWhenUiLocked: true,
      });
    } else {
      menuData.push({
        type: "button",
        label: "テンポ変化を挿入",
        onClick: () => {
          Dialog.create({
            component: TempoChangeDialog,
            componentProps: {
              tempoChange: tempos.value[0],
              mode: "add",
            },
          }).onOk((result: { tempoChange: Omit<Tempo, "position"> }) => {
            setTempo({
              ...result.tempoChange,
              position: valueChange.value!.position,
            });
          });
        },
        disableWhenUiLocked: true,
      });
    }

    if (menuData.length > 0) {
      menuData.push({
        type: "separator",
      });
    }

    // 拍子変更のメニュー項目
    if (valueChange.value.timeSignatureChange) {
      menuData.push({
        type: "button",
        label: "拍子変化を編集",
        onClick: () => {
          Dialog.create({
            component: TimeSignatureChangeDialog,
            componentProps: {
              timeSignatureChange: valueChange.value!.timeSignatureChange,
              mode: "edit",
            },
          }).onOk(
            (result: {
              timeSignatureChange: Omit<TimeSignature, "position">;
            }) => {
              setTimeSignature({
                ...result.timeSignatureChange,
                measureNumber: tickToMeasureNumber(
                  valueChange.value!.position,
                  timeSignatures.value,
                  tpqn.value,
                ),
              });
            },
          );
        },
        disableWhenUiLocked: true,
      });

      menuData.push({
        type: "button",
        label: "拍子変化を削除",
        disabled: valueChange.value.position === 0,
        onClick: () => {
          removeTimeSignature(
            tickToMeasureNumber(
              valueChange.value!.position,
              timeSignatures.value,
              tpqn.value,
            ),
          );
        },
        disableWhenUiLocked: true,
      });
    } else {
      menuData.push({
        type: "button",
        label: "拍子変化を挿入",
        onClick: () => {
          Dialog.create({
            component: TimeSignatureChangeDialog,
            componentProps: {
              timeSignatureChange: timeSignatures.value[0],
              mode: "add",
            },
          }).onOk(
            (result: {
              timeSignatureChange: Omit<TimeSignature, "position">;
            }) => {
              setTimeSignature({
                ...result.timeSignatureChange,
                measureNumber: tickToMeasureNumber(
                  valueChange.value!.position,
                  timeSignatures.value,
                  tpqn.value,
                ),
              });
            },
          );
        },
        disableWhenUiLocked: true,
      });
    }
  } else {
    // 新規追加のメニュー項目
    menuData.push({
      type: "button",
      label: "テンポ変化を挿入",
      onClick: () => {
        Dialog.create({
          component: TempoChangeDialog,
          componentProps: {
            tempoChange: tempos.value[0],
            mode: "add",
          },
        }).onOk((result: { tempoChange: Omit<Tempo, "position"> }) => {
          setTempo({
            ...result.tempoChange,
            position: playheadTicks.value,
          });
        });
      },
      disableWhenUiLocked: true,
    });

    menuData.push({
      type: "button",
      label: "拍子変化を挿入",
      onClick: () => {
        Dialog.create({
          component: TimeSignatureChangeDialog,
          componentProps: {
            timeSignatureChange: timeSignatures.value[0],
            mode: "add",
          },
        }).onOk(
          (result: {
            timeSignatureChange: Omit<TimeSignature, "position">;
          }) => {
            setTimeSignature({
              ...result.timeSignatureChange,
              measureNumber: tickToMeasureNumber(
                playheadTicks.value,
                timeSignatures.value,
                tpqn.value,
              ),
            });
          },
        );
      },
      disableWhenUiLocked: true,
    });
  }

  return menuData;
});

const contextMenuHeader = computed(() => {
  if (!valueChange.value) return "";
  const texts = [];
  if (valueChange.value.tempoChange) {
    texts.push(`テンポ：${valueChange.value.tempoChange.bpm}`);
  }
  if (valueChange.value.timeSignatureChange) {
    texts.push(
      `拍子：${valueChange.value.timeSignatureChange.beats}/${valueChange.value.timeSignatureChange.beatType}`,
    );
  }
  return texts.join("、");
});
</script>
