<template>
  <AcceptDialog
    v-model="modelValueComputed"
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
import { computed, ref, onMounted } from "vue";
import AcceptDialog from "./AcceptDialog.vue";
import { useStore } from "@/store";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const store = useStore();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const handler = (acceptRetrieveTelemetry: boolean) => {
  void store.actions.SET_ACCEPT_RETRIEVE_TELEMETRY({
    acceptRetrieveTelemetry: acceptRetrieveTelemetry ? "Accepted" : "Refused",
  });

  modelValueComputed.value = false;
};

const privacyPolicy = ref("");
onMounted(async () => {
  privacyPolicy.value = await store.actions.GET_PRIVACY_POLICY_TEXT();
});
</script>
