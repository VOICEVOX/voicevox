<!--
  テンポや拍子などを変更・追加するためのダイアログ
-->
<template>
  <QDialog ref="dialogRef" v-model="modelValue">
    <QCard class="q-py-sm q-px-md dialog-card">
      <QCardSection>
        <div class="text-h5">
          {{ props.title }}
        </div>
      </QCardSection>

      <QSeparator />

      <QCardSection>
        <QCardActions>
          <div>{{ props.name }}</div>
          <QSpace />
          <slot />
        </QCardActions>
      </QCardSection>

      <QSeparator />

      <QCardActions>
        <QSpace />
        <QBtn
          unelevated
          label="キャンセル"
          color="surface"
          textColor="display"
          class="text-no-wrap text-bold q-mr-sm"
          @click="handleCancel"
        />
        <QBtn
          unelevated
          :label="okText"
          color="primary"
          textColor="display-on-primary"
          class="text-no-wrap text-bold q-mr-sm"
          @click="handleOk"
        />
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from "quasar";
import { computed } from "vue";

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const modelValue = defineModel<boolean>();
const props = defineProps<{
  title: string;
  mode: "add" | "edit";
  name: string;
}>();
defineSlots<{
  default(props: Record<string, never>): void;
}>();

defineEmits({
  ...useDialogPluginComponent.emitsObject,
});

const okText = computed(() =>
  props.mode === "edit" ? "変更する" : "追加する",
);

const handleOk = () => {
  onDialogOK();
};

const handleCancel = () => {
  onDialogCancel();
  modelValue.value = false;
};
</script>

<style scoped lang="scss">
.dialog-card {
  width: 400px;
  max-width: 40vw;
}

.value-input {
  width: 60px;
}
</style>
