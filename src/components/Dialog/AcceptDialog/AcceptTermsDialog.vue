<template>
  <AcceptDialog
    v-model:dialogOpened="dialogOpened"
    title="利用規約に関するお知らせ"
    rejectLabel="同意せずに終了"
    acceptLabel="同意して使用開始"
    heading="利用規約"
    :terms
    @reject="handler(false)"
    @accept="handler(true)"
  >
    <p>
      多くの人が安心して VOICEVOX を使えるよう、利用規約への同意をお願いします。
    </p>
  </AcceptDialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import AcceptDialog from "./AcceptDialog.vue";
import { useStore } from "@/store";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

const store = useStore();

const handler = (acceptTerms: boolean) => {
  void store.actions.SET_ACCEPT_TERMS({
    acceptTerms: acceptTerms ? "Accepted" : "Rejected",
  });
  if (!acceptTerms) {
    void store.actions.CHECK_EDITED_AND_NOT_SAVE({
      closeOrReload: "close",
    });
  }

  dialogOpened.value = false;
};

const terms = ref("");
onMounted(async () => {
  terms.value = await store.actions.GET_POLICY_TEXT();
});
</script>
