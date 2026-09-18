<template>
  <div ref="valueChangesLane" class="value-changes-lane">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      :width
      :height
      shape-rendering="crispEdges"
      class="value-changes-lane-svg"
      @contextmenu.stop.prevent="onLaneContextMenu"
    >
      <!-- レーン全体に透明背景を敷いて、空き部分の右クリックを拾う -->
      <rect
        class="lane-background"
        :width
        height="20"
        y="20"
        fill="transparent"
        @contextmenu.stop.prevent="onLaneContextMenu"
      />

      <!-- テンポ・拍子表示 -->
      <template v-for="item in displayValueChanges" :key="item.position">
        <g class="value-changes-lane-item">
          <text
            ref="valueChangeText"
            font-size="12"
            :x="item.x - offset + valueChangeTextPadding"
            y="34"
            class="value-changes-lane-value-change"
            @click.stop="onValueClick($event, item.original)"
            @contextmenu.stop.prevent="onValueClick($event, item.original)"
          >
            {{ item.displayText }}
          </text>
          <line
            :x1="item.x - offset"
            :x2="item.x - offset"
            y1="0"
            :y2="height"
            class="value-changes-lane-value-change-line"
          />
        </g>
      </template>
    </svg>
    <ContextMenu
      ref="contextMenu"
      :menudata="contextMenuData"
      :header="contextMenuHeader"
      :uiLocked
      @hide="emit('contextMenuHide')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef, onMounted, onUnmounted } from "vue";
import type { ValueChange } from "./Container.vue";
import ContextMenu, {
  type ContextMenuItemData,
} from "@/components/Menu/ContextMenu/Presentation.vue";
import { createLogger } from "@/helpers/log";
import { type FontSpecification, predictTextWidth } from "@/helpers/textWidth";

defineOptions({
  name: "ValueChangesLanePresentation",
});

const props = defineProps<{
  width: number;
  height?: number;
  offset: number;
  valueChanges: ValueChange[];
  contextMenuData: ContextMenuItemData[];
  contextMenuHeader: string;
  uiLocked: boolean;
}>();

const emit = defineEmits<{
  valueChangeClick: [event: MouseEvent, valueChange: ValueChange | null];
  contextMenuHide: [];
}>();

const height = ref(props.height ?? 44);
const valueChangeTextPadding = 4;
const contextMenu = ref<InstanceType<typeof ContextMenu> | null>(null);
const log = createLogger("ValueChangesLane");

// レーンのリサイズ監視
const valueChangesLane = useTemplateRef<HTMLDivElement>("valueChangesLane");
let resizeObserver: ResizeObserver | undefined;

onMounted(() => {
  const element = valueChangesLane.value;
  if (!element) {
    throw new Error("valueChangesLane element is null.");
  }
  resizeObserver = new ResizeObserver((entries) => {
    let blockSize = 0;
    for (const entry of entries) {
      for (const borderBoxSize of entry.borderBoxSize) {
        blockSize = borderBoxSize.blockSize;
      }
    }
    if (blockSize > 0 && blockSize !== height.value) {
      height.value = blockSize;
    }
  });
  resizeObserver.observe(element);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

// フォントスタイルの取得
const valueChangeText = useTemplateRef<SVGTextElement[]>("valueChangeText");
const valueChangeTextStyle = computed<FontSpecification | null>(() => {
  if (!valueChangeText.value || valueChangeText.value.length === 0) {
    return null;
  }
  // NOTE: フォントの変更に対応していないが、基本的にフォントが変更されることは少ないので、
  // 複雑性を下げるためにも対応しない
  const style = window.getComputedStyle(valueChangeText.value[0]);
  return {
    fontFamily: style.fontFamily,
    fontSize: parseFloat(style.fontSize),
    fontWeight: style.fontWeight,
  };
});

// 表示用のValueChanges（テキスト幅や位置を表示用に考慮）
// TODO: 良い型があれば修正したい
type DisplayValueChange = {
  position: number;
  x: number;
  displayText: string;
  original: ValueChange;
};

// 表示用のテンポ・拍子
const displayValueChanges = computed<DisplayValueChange[]>(() => {
  const result: DisplayValueChange[] = props.valueChanges.map(
    (valueChange) => ({
      position: valueChange.position,
      x: valueChange.x,
      displayText: valueChange.text,
      original: valueChange,
    }),
  );

  // フォントスタイルが取得できている場合のみテキスト幅の計算を行う
  if (valueChangeTextStyle.value) {
    // NOTE: テキストの幅を計算して、表示できるかどうかを判定する
    //   full: 通常表示（120 4/4）
    //   ellipsis: fullが入りきらないときに表示する（...）
    //   hidden: ellipsisも入りきらないときに表示する
    const collapsedTextWidth =
      predictTextWidth("...", valueChangeTextStyle.value) +
      valueChangeTextPadding * 2;

    for (const [i, item] of result.entries()) {
      const next = result.at(i + 1);
      if (!next) continue;

      const requiredWidth =
        predictTextWidth(item.displayText, valueChangeTextStyle.value) +
        valueChangeTextPadding * 2;
      const width = next.x - item.x;

      if (collapsedTextWidth > width) {
        item.displayText = "";
      } else if (requiredWidth > width) {
        item.displayText = "...";
      }
    }
  } else {
    log.warn("valueChangeTextElement is null. Cannot calculate text width.");
  }

  return result;
});

const onLaneContextMenu = (event: MouseEvent) => {
  emit("valueChangeClick", event, null);
  contextMenu.value?.show(event);
};

const onValueClick = (event: MouseEvent, valueChange: ValueChange) => {
  emit("valueChangeClick", event, valueChange);
  contextMenu.value?.show(event);
};
</script>

<style scoped lang="scss">
.value-changes-lane {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.value-changes-lane-svg {
  pointer-events: none;
}

.value-changes-lane-item {
  pointer-events: none;
}

.lane-background {
  pointer-events: auto;
}

.value-changes-lane-value-change {
  font-weight: 600;
  fill: var(--scheme-color-on-surface-variant);
  pointer-events: auto;
  cursor: pointer;

  &:hover {
    cursor: pointer;
    text-decoration: underline;
  }
}

.value-changes-lane-value-change-line {
  backface-visibility: hidden;
  stroke: var(--scheme-color-on-surface-variant);
  stroke-width: 1px;
  pointer-events: none;
}
</style>
