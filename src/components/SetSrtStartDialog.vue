<template>
  <q-dialog>
    <q-card>
      <q-card-section> 字幕の開始時間を設定してください </q-card-section>
      <q-card-section
        ><input
          id="time-input"
          class="time-input"
          type="time"
          name="appt-time"
          step="2"
          value="00:00:00"
      /></q-card-section>
      <q-card-actions>
        <q-btn v-close-popup flat label="Close" @click="closeDialog" />
        <q-btn
          v-close-popup
          class="ok-button"
          flat
          label="OK"
          @click="updateSrtStartTimeOnMenuBarProp"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { useStore } from "@/store";
const store = useStore();

const updateSrtStartTimeOnMenuBarProp = () => {
  const inputtedTime = document.getElementById(
    "time-input"
  ) as HTMLInputElement;
  // inputedtime.valueをnumber型に変換する
  const [hours, minutes, seconds] = inputtedTime.value.split(":").map(Number);
  const timeInSeconds = hours * 3600 + minutes * 60 + seconds;
  store.commit("SET_SRT_START_TIME", {
    srtStartTime: timeInSeconds,
  });
  store.commit("IS_SRT_DIALOG_OPEN", {
    isOpen: false,
  });
};

const closeDialog = () => {
  store.commit("IS_SRT_DIALOG_OPEN", {
    isOpen: false,
  });
};
</script>

<style scoped lang="scss">
.time-input {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}
.ok-button {
  position: absolute;
  right: 0;
}
</style>
