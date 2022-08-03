<template>
  <q-dialog
    :model-value="openDialog"
    @update:model-value="updateOpenDialog"
    @before-show="initializeInput"
  >
    <q-card class="q-pa-md dialog-card">
      <q-card-section>
        <div class="text-h5">書き出しファイル名パターン</div>
        <div class="text-body2 text-grey-8">
          「$キャラ$」のようなタグを使って書き出すファイル名をカスタマイズできます
        </div>
      </q-card-section>
      <q-card-actions class="setting-card q-px-md q-py-sm">
        <div class="row full-width justify-between">
          <div class="col">
            <q-input
              dense
              outlined
              bg-color="background"
              label="ファイル名パターン"
              suffix=".wav"
              :maxlength="maxLength"
              :error="hasError"
              :error-message="errorMessage"
              v-model="currentFileNamePattern"
              ref="patternInput"
            >
              <template v-slot:after>
                <q-btn
                  label="デフォルトにリセット"
                  unelevated
                  color="background-light"
                  text-color="display-dark"
                  class="text-no-wrap q-mr-sm"
                  @click="resetToDefault"
                />
              </template>
            </q-input>
          </div>
        </div>
        <div class="text-body2 text-ellipsis">
          出力例）{{ previewFileName }}
        </div>
        <div class="row full-width q-my-md">
          <q-btn
            v-for="tagString in tagStrings"
            :key="tagString"
            :label="`$${tagString}$`"
            unelevated
            color="background-light"
            text-color="display-dark"
            class="text-no-wrap q-mr-sm"
            @click="insertTagToCurrentPosition(`$${tagString}$`)"
          />
        </div>
        <div class="row full-width justify-end">
          <q-btn
            label="キャンセル"
            unelevated
            color="background-light"
            text-color="display-dark"
            class="text-no-wrap text-bold q-mr-sm col-2"
            @click="updateOpenDialog(false)"
          />
          <q-btn
            label="確定"
            unelevated
            color="background-light"
            text-color="display-dark"
            class="text-no-wrap text-bold q-mr-sm col-2"
            :disable="hasError"
            @click="submit"
          />
        </div>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, nextTick } from "vue";
import { QInput } from "quasar";
import { useStore } from "@/store";
import {
  buildFileNameFromRawData,
  DEFAULT_FILE_NAME_TEMPLATE,
  replaceTagIdToTagString,
  sanitizeFileName,
} from "@/store/utility";

export default defineComponent({
  name: "FileNamePatternDialog",

  props: {
    openDialog: Boolean,
  },

  emits: ["update:openDialog"],

  setup(props, context) {
    const updateOpenDialog = (isOpen: boolean) =>
      context.emit("update:openDialog", isOpen);

    const store = useStore();
    const patternInput = ref<QInput>();
    const maxLength = 128;
    const tagStrings = Object.values(replaceTagIdToTagString);

    const savingSetting = computed(() => store.state.savingSetting);

    const currentFileNamePattern = ref(savingSetting.value.fileNamePattern);
    const sanitizedFileNamePattern = computed(() =>
      sanitizeFileName(currentFileNamePattern.value)
    );

    const hasInvalidChar = computed(
      () => currentFileNamePattern.value !== sanitizedFileNamePattern.value
    );
    const hasNotIndexTagString = computed(
      () =>
        !currentFileNamePattern.value.includes(replaceTagIdToTagString["index"])
    );
    const invalidChar = computed(() => {
      if (!hasInvalidChar.value) return "";

      const a = currentFileNamePattern.value;
      const b = sanitizedFileNamePattern.value;

      let diffAt = "";
      for (let i = 0; i < a.length; i++) {
        if (b[i] !== a[i]) {
          diffAt = a[i];
          break;
        }
      }

      return diffAt;
    });
    const errorMessage = computed(() => {
      if (currentFileNamePattern.value.length === 0) {
        return "何か入力してください";
      }

      const result: string[] = [];
      if (invalidChar.value !== "") {
        result.push(
          `使用できない文字が含まれています：「${invalidChar.value}」`
        );
      }
      if (previewFileName.value.includes("$")) {
        result.push(`不正なタグが存在するか、$が単体で含まれています`);
      }
      if (hasNotIndexTagString.value) {
        result.push(`$${replaceTagIdToTagString["index"]}$は必須です`);
      }
      return result.join(", ");
    });
    const hasError = computed(() => errorMessage.value !== "");

    const previewFileName = computed(() =>
      buildFileNameFromRawData(currentFileNamePattern.value + ".wav")
    );

    const removeExtension = (str: string) => {
      return str.replace(/\.wav$/, "");
    };

    const initializeInput = () => {
      const pattern = savingSetting.value.fileNamePattern;
      currentFileNamePattern.value = removeExtension(pattern);

      if (currentFileNamePattern.value.length === 0) {
        currentFileNamePattern.value = removeExtension(
          DEFAULT_FILE_NAME_TEMPLATE
        );
      }
    };
    const resetToDefault = () => {
      currentFileNamePattern.value = removeExtension(
        DEFAULT_FILE_NAME_TEMPLATE
      );
      patternInput.value?.focus();
    };

    const insertTagToCurrentPosition = (tag: string) => {
      const elem = patternInput.value?.getNativeElement() as HTMLInputElement;
      if (elem) {
        const text = elem.value;

        if (text.length + tag.length > maxLength) {
          return;
        }

        const from = elem.selectionStart ?? 0;
        const to = elem.selectionEnd ?? 0;
        const newText = text.substring(0, from) + tag + text.substring(to);
        currentFileNamePattern.value = newText;

        // キャレットの位置を挿入した後の位置にずらす
        nextTick(() => {
          elem.selectionStart = from + tag.length;
          elem.selectionEnd = from + tag.length;
          elem.focus();
        });
      }
    };

    const submit = async () => {
      await store.dispatch("SET_SAVING_SETTING", {
        data: {
          ...savingSetting.value,
          fileNamePattern: currentFileNamePattern.value + ".wav",
        },
      });
      updateOpenDialog(false);
    };

    return {
      patternInput,
      tagStrings,
      maxLength,
      updateOpenDialog,
      resetToDefault,
      insertTagToCurrentPosition,
      submit,
      initializeInput,
      savingSetting,
      currentFileNamePattern,
      errorMessage,
      hasError,
      previewFileName,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.setting-card {
  width: 100%;
  min-width: 475px;
  background: colors.$setting-item;
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
