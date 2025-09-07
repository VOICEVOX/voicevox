<template>
  <QDialog
    ref="dialogRef"
    v-model="modelValue"
    persistent
    @update:modelValue="handleOpenUpdate"
  >
    <QCard class="policy-dialog q-py-sm q-px-md">
      <QCardSection>
        <div class="text-h5">キャラクター利用規約への同意</div>
        <div class="text-body2 text-grey-8">
          音声を書き出すには以下のキャラクターの利用規約への同意が必要です。
        </div>
      </QCardSection>

      <QSeparator />

      <QCardSection class="q-py-md scroll scrollable-area">
        <div class="character-policies">
          <div
            v-for="info in characterPolicyInfos"
            :key="info.id"
            class="character-policy-item"
          >
            <div class="character-portrait-section">
              <img 
                :src="info.portraitPath" 
                class="character-portrait" 
                :alt="info.name"
              />
            </div>
            <div class="character-info-section">
              <div class="character-name">{{ info.name }}</div>
              <div class="character-policy">{{ info.policy }}</div>
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
          label="同意して続行"
          unelevated
          color="surface"
          textColor="display"
          class="q-mt-sm text-bold"
          @click="handleAccept"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDialogPluginComponent } from "quasar";
import { SpeakerId } from "@/type/preload";

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

const characterIds = computed(() =>
  props.characterPolicyInfos.map((c) => c.id),
);

const handleCancel = () => {
  onDialogCancel();
};

const handleAccept = () => {
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

.policy-dialog {
  width: 700px;
  max-width: 80vw;
}

.scrollable-area {
  overflow-y: auto;
  max-height: 50vh;
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
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.character-portrait-section {
  flex-shrink: 0;
  width: 5rem;
  height: 7rem;
  display: grid;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  border-radius: vars.$radius-1;
}

.character-portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  border-radius: vars.$radius-1;
}

.character-info-section {
  flex: 1;
  min-width: 0;
}

.character-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: vars.$gap-1;
  color: colors.$display;
}

.character-policy {
  font-size: 0.875rem;
  line-height: 1.4;
  color: colors.$display;
  white-space: pre-wrap;
}
</style>
