<template>
  <QDialog
    :modelValue="props.openDialog"
    @update:modelValue="updateOpenDialog"
    @beforeShow="initializeInput"
  >
    <QCard class="q-pa-md dialog-card">
      <QCardSection>
        <div class="text-h5">書き出しファイル名パターン</div>
        <div class="text-body2 text-grey-8">
          「$キャラ$」のようなタグを使って書き出すファイル名をカスタマイズできます。
        </div>
      </QCardSection>
      <QCardActions class="setting-card q-px-md q-py-sm">
        <div class="row full-width justify-between">
          <div class="col">
            <QInput
              ref="patternInput"
              v-model="temporaryTemplate"
              dense
              outlined
              bgColor="background"
              label="ファイル名パターン"
              :suffix="props.extension"
              :maxlength="maxLength"
              :error="hasError"
              :errorMessage
            >
              <template #after>
                <QBtn
                  label="デフォルトにリセット"
                  outline
                  textColor="display"
                  class="text-no-wrap q-mr-sm"
                  @click="resetToDefault"
                />
              </template>
            </QInput>
          </div>
        </div>
        <div class="text-body2 text-ellipsis">
          出力例：{{ previewFileName }}
        </div>
        <div class="row full-width q-my-md">
          <QBtn
            v-for="tagString in tagStrings"
            :key="tagString"
            :label="`$${tagString}$`"
            outline
            textColor="display"
            class="text-no-wrap q-mr-sm"
            @click="insertTagToCurrentPosition(`$${tagString}$`)"
          />
        </div>
        <div class="row full-width justify-end">
          <QBtn
            label="キャンセル"
            outline
            textColor="display"
            class="text-no-wrap text-bold q-mr-sm col-2"
            @click="updateOpenDialog(false)"
          />
          <QBtn
            label="確定"
            unelevated
            color="primary"
            textColor="display-on-primary"
            class="text-no-wrap text-bold q-mr-sm col-2"
            :disable="hasError"
            @click="submit"
          />
        </div>
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from "vue";
import { QInput } from "quasar";
import { replaceTagIdToTagString, sanitizeFileName } from "@/store/utility";
import { UnreachableError } from "@/type/utility";

const props = defineProps<{
  /** ダイアログが開いているかどうか */
  openDialog: boolean;
  /** デフォルトのテンプレート */
  defaultTemplate: string;
  /** 使用可能なタグ */
  availableTags: (keyof typeof replaceTagIdToTagString)[];
  /** 保存されているテンプレート */
  savedTemplate: string;
  /** ファイル名を生成する関数 */
  fileNameBuilder: (pattern: string) => string;
  /** ドットまで含んだ拡張子 */
  extension: string;
}>();

const emit = defineEmits<{
  (e: "update:openDialog", val: boolean): void;
  (e: "update:template", val: string): void;
}>();

const updateOpenDialog = (isOpen: boolean) => emit("update:openDialog", isOpen);
const updateFileNamePattern = (pattern: string) =>
  emit("update:template", pattern);

const patternInput = ref<QInput>();
const maxLength = 128;
const tagStrings = computed(() =>
  props.availableTags.map((tag) => replaceTagIdToTagString[tag]),
);

const temporaryTemplate = ref(props.savedTemplate);

const missingIndexTagString = computed(
  () => !temporaryTemplate.value.includes(replaceTagIdToTagString["index"]),
);
const invalidChar = computed(() => {
  const current = temporaryTemplate.value;
  const sanitized = sanitizeFileName(current);
  return Array.from(current).find((char, i) => char !== sanitized[i]);
});
const errorMessage = computed(() => {
  if (temporaryTemplate.value === "") {
    return "何か入力してください";
  }

  const result: string[] = [];
  if (invalidChar.value != undefined) {
    result.push(`使用できない文字が含まれています：「${invalidChar.value}」`);
  }
  if (previewFileName.value.includes("$")) {
    result.push(`不正なタグが存在するか、$が単体で含まれています`);
  }
  if (missingIndexTagString.value) {
    result.push(`$${replaceTagIdToTagString["index"]}$は必須です`);
  }
  return result.join(", ");
});
const hasError = computed(() => errorMessage.value !== "");

const previewFileName = computed(
  () => props.fileNameBuilder(temporaryTemplate.value) + props.extension,
);

const initializeInput = () => {
  temporaryTemplate.value = props.savedTemplate;

  if (temporaryTemplate.value === "") {
    temporaryTemplate.value = props.defaultTemplate;
  }
};
const resetToDefault = () => {
  temporaryTemplate.value = props.defaultTemplate;
  patternInput.value?.focus();
};

const insertTagToCurrentPosition = (tag: string) => {
  const elem = patternInput.value?.nativeEl as HTMLInputElement;
  if (elem) {
    const text = elem.value;

    if (text.length + tag.length > maxLength) {
      return;
    }

    const from = elem.selectionStart ?? 0;
    const to = elem.selectionEnd ?? 0;
    const newText = text.substring(0, from) + tag + text.substring(to);
    temporaryTemplate.value = newText;

    // キャレットの位置を挿入した後の位置にずらす
    void nextTick(() => {
      elem.selectionStart = from + tag.length;
      elem.selectionEnd = from + tag.length;
      elem.focus();
    });
  }
};

const submit = async () => {
  if (hasError.value) {
    throw new UnreachableError("assert: hasError is false");
  }

  updateFileNamePattern(temporaryTemplate.value);
  updateOpenDialog(false);
};
</script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.setting-card {
  width: 100%;
  min-width: 475px;
  background: colors.$surface;
}

.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dialog-card {
  width: 700px;
  max-width: 80vw;
}
</style>
