<template>
  <QDialog v-model="dialogOpened" persistent>
    <QCard class="policy-dialog q-py-sm q-px-md">
      <QCardSection>
        <div class="text-h5">キャラクター利用規約への同意</div>
        <div class="text-body2 text-grey-8">
          音声を書き出すには以下のキャラクターの利用規約への同意が必要です。
        </div>
      </QCardSection>

      <QSeparator />

      <!-- 
      TODO: 立ち絵を表示する
      -->

      <QCardSection class="q-py-none scroll scrollable-area">
        <div class="character-policies">
          <div
            v-for="info in characterPolicyInfos"
            :key="info.id"
            class="character-policy-item"
          >
            <div class="character-name">{{ info.name }}</div>
            <div class="character-policy">{{ info.policy }}</div>
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
          class="q-mt-sm"
          @click="$emit('cancel')"
        />
        <QBtn
          padding="xs md"
          label="同意して続行"
          unelevated
          color="primary"
          textColor="display-on-primary"
          class="q-mt-sm"
          @click="$emit('accept', characterIds)"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { SpeakerId } from "@/type/preload";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

type CharacterPolicyInfo = {
  id: SpeakerId;
  name: string;
  policy: string;
  portraitPath: string;
};

const props = defineProps<{
  characterPolicyInfos: CharacterPolicyInfo[];
}>();

defineEmits<{
  (e: "cancel"): void;
  (e: "accept", characterIds: SpeakerId[]): void;
}>();

const characterIds = computed(() =>
  props.characterPolicyInfos.map((c) => c.id),
);
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
  padding: vars.$padding-2;
  border: 1px solid colors.$border;
  background-color: colors.$surface;
  border-radius: vars.$radius-2;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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
