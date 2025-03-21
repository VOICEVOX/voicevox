<template>
  <AcceptDialog
    v-model:dialogOpened="dialogOpened"
    title="使いやすさ向上のためのお願い"
    rejectLabel="拒否"
    acceptLabel="許可"
    heading="プライバシーポリシー"
    :terms="privacyPolicy"
    @reject="handler(false)"
    @accept="handler(true)"
  >
    <p>VOICEVOXはより使いやすいソフトウェアを目指して開発されています。</p>
    <p>
      ボタンの配置換えなどの方針を決める際は、各UIの利用率などの情報が重要になります。もしよろしければ、ソフトウェアの利用状況のデータ収集にご協力お願いします。
    </p>
    <p>
      （入力されたテキストデータや音声データの情報は収集しておりませんのでご安心ください。）
    </p>
  </AcceptDialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import AcceptDialog from "./AcceptDialog.vue";
import { useStore } from "@/store";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

const store = useStore();

const handler = (acceptRetrieveTelemetry: boolean) => {
  void store.actions.SET_ACCEPT_RETRIEVE_TELEMETRY({
    acceptRetrieveTelemetry: acceptRetrieveTelemetry ? "Accepted" : "Refused",
  });

  dialogOpened.value = false;
};

const privacyPolicy = ref("");
onMounted(async () => {
  privacyPolicy.value = await store.actions.GET_PRIVACY_POLICY_TEXT();
});
</script>
