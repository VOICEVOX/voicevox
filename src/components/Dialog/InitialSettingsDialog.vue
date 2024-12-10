<template>
  <QDialog :modelValue="true">
    <QCard class="q-pa-md">
      <QCardSection class="dialog-text">
        <div class="text-h5">どちらに興味がありますか？</div>
        <div class="text-body2 text-grey-8">
          選択したエディタを開きます。アプリケーション右上からトークとソングを切り替えることができます。
        </div>
      </QCardSection>
      <QCardActions class="button-group q-px-md q-py-sm">
        <div class="col q-px-md">
          <QBtn
            label="トーク"
            outline
            textColor="display"
            class="text-no-wrap text-bold q-mr-sm"
          />
          <QBtn
            label="ソング"
            outline
            textColor="display"
            class="text-no-wrap text-bold q-mr-sm"
          />
        </div>
      </QCardActions>
    </QCard>
  </QDialog>
</template>

<script setup lang="ts"></script>

<style scoped lang="scss">
@use "@/styles/colors" as colors;

.dialog-text {
  text-align: center;
}
.button-group {
  justify-content: center;
}
</style>
