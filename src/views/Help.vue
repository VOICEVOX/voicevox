<template>
  <div class="help">
    <mcw-drawer ref="drawer" dismissible>
      <mcw-list-item to="/help/policy">ソフトウェアの利用規約</mcw-list-item>
      <mcw-list-item to="/help/library-policy"
        >音声ライブラリの利用規約</mcw-list-item
      >
      <mcw-list-item to="/help/how-to-use">使い方</mcw-list-item>
      <mcw-list-item to="/help/oss-license">OSSライセンス情報</mcw-list-item>
      <mcw-list-item to="/help/update-info">アップデート情報</mcw-list-item>
    </mcw-drawer>
    <router-view />
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

    // 最初からshowがない
    const drawer = ref<any>();
    onMounted(() => {
      drawer.value!.show();
    });
    return { drawer };
  },
});
</script>

<style lang="scss">
// scopedにするとリリースビルド時に何故か効かなくなる
.help {
  display: flex;
  height: 100%;
  > aside {
    position: static !important;
  }
}
</style>
