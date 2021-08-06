<template>
  <div class="full-height help">
    <q-layout view="lHh Lpr lff" container>
      <q-drawer
        bordered
        show-if-above
        v-model="drawer"
        :width="250"
        :breakpoint="0"
      >
        <q-list>
          <q-item clickable to="/help/policy" active-class="selected-item">
            <q-item-section>ソフトウェアの利用規約</q-item-section>
          </q-item>
          <q-item
            clickable
            to="/help/library-policy"
            active-class="selected-item"
          >
            <q-item-section>音声ライブラリの利用規約</q-item-section>
          </q-item>
          <q-item clickable to="/help/how-to-use" active-class="selected-item">
            <q-item-section>使い方</q-item-section>
          </q-item>
          <q-item clickable to="/help/oss-license" active-class="selected-item">
            <q-item-section>OSSライセンス情報</q-item-section>
          </q-item>
          <q-item clickable to="/help/update-info" active-class="selected-item">
            <q-item-section>アップデート情報</q-item-section>
          </q-item>
        </q-list>
      </q-drawer>

      <q-page-container>
        <q-page>
          <router-view />
        </q-page>
      </q-page-container>
    </q-layout>
  </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { LOAD_CHARACTOR } from "@/store/audio";
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  setup() {
    const store = useStore();

    // 初期化
    onMounted(async () => {
      // TODO: 別ウィンドウなので再読み込みしないといけない。設計が良くないので直したい。
      await store.dispatch(LOAD_CHARACTOR);
    });

    const drawer = ref(true);

    return { drawer };
  },
});
</script>

<style lang="scss">
// scopedにするとリリースビルド時に何故か効かなくなる
@use '@/styles' as global;

.help {
  .selected-item {
    background-color: rgba(global.$primary, 0.4);
  }
}
</style>
