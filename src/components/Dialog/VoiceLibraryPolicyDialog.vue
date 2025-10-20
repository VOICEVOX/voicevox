<template>
  <QDialog
    ref="dialogRef"
    v-model="modelValue"
    persistent
    @update:modelValue="handleOpenUpdate"
  >
    <QCard class="policy-dialog q-py-sm q-px-md">
      <QCardSection>
        <div class="text-h5">音声ライブラリ利用規約のご案内</div>
        <div class="text-body2 text-grey-8">
          音声の利用には音声ライブラリ利用規約が適用されます。
        </div>
      </QCardSection>

      <QSeparator />

      <QCardSection class="q-py-md scroll scrollable-area">
        <div role="list" class="character-policies">
          <div
            v-for="info in enrichedCharacterInfos"
            :key="info.id"
            role="listitem"
            class="character-policy-item"
          >
            <div class="character-portrait-section">
              <img :src="info.portraitPath" />
            </div>
            <div class="character-info-section">
              <div class="character-name">{{ info.name }}</div>
              <BaseDocumentView>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div v-html="info.renderedPolicy"></div>
              </BaseDocumentView>
            </div>
          </div>
        </div>
      </QCardSection>

      <QSeparator />

      <QCardActions>
        <QSpace />
        <QBtn
          padding="xs md"
          label="キャンセル"
          unelevated
          color="surface"
          textColor="display"
          class="q-mt-sm text-bold"
          @click="handleCancel"
        />
        <QBtn
          padding="xs md"
          label="確認して続行"
          unelevated
          color="surface"
          textColor="display"
          class="q-mt-sm text-bold"
          @click="handleOk"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDialogPluginComponent } from "quasar";
import { SpeakerId } from "@/type/preload";
import BaseDocumentView from "@/components/Base/BaseDocumentView.vue";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const modelValue = defineModel<boolean>({ default: false });

type CharacterPolicyInfo = {
  id: SpeakerId;
  name: string;
  policy: string;
  portraitPath: string;
};

const props = defineProps<{
  characterPolicyInfos: CharacterPolicyInfo[];
}>();

defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const { dialogRef, onDialogOK, onDialogCancel, onDialogHide } =
  useDialogPluginComponent();

const md = useMarkdownIt();

const enrichedCharacterInfos = computed(() =>
  props.characterPolicyInfos.map((info) => ({
    id: info.id,
    name: info.name,
    portraitPath: info.portraitPath,
    renderedPolicy: md.render(info.policy),
  })),
);

const characterIds = computed(() =>
  enrichedCharacterInfos.value.map((c) => c.id),
);

const handleCancel = () => {
  onDialogCancel();
};

const handleOk = () => {
  onDialogOK(characterIds.value);
};

const handleOpenUpdate = (isOpen: boolean) => {
  if (!isOpen) {
    onDialogHide();
  }
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.policy-dialog {
  width: 700px;
  max-width: 80vw;
}

.scrollable-area {
  overflow-y: auto;
  max-height: calc(100vh - 100px - 295px);
}

.character-policies {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-2;
}

.character-policy-item {
  display: flex;
  gap: vars.$gap-2;
  padding: vars.$padding-2;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
  border-radius: vars.$radius-2;
}

.character-portrait-section {
  width: 6rem;
  height: 9rem;
  display: flex;
  justify-content: center;
  overflow: hidden;
}

.character-info-section {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.character-name {
  @include mixin.headline-2;
}
</style>
