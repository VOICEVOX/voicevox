<template>
  <nav role="tab">
    <ul class="singer-tab">
      <li class="singer-tab-item">
        <router-link to="/home">ボイス</router-link>
      </li>
      <li class="singer-tab-item">
        <router-link to="/singer-home">シング</router-link>
      </li>
    </ul>
  </nav>
</template>

<script lang="ts">
import { defineComponent, onMounted } from "vue";
//import { useStore } from "@/store";
//import { useRoute, useRouter } from "vue-router";
export default defineComponent({
  setup() {
    //const store = useStore();
    onMounted(async () => {
      return null;
    });
    return null;
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;
.singer-tab {
  border-bottom: 1px solid colors.$splitter;
  display: flex;
  list-style: none;
  margin-bottom: 0;
  padding-left: 0;
}
.singer-tab a {
  display: block;
  color: colors.$display;
  border-bottom: 2px solid transparent;
  text-decoration: none;
  padding: 8px;
}
.singer-tab-item a.router-link-exact-active {
  border-bottom-color: colors.$primary;
}
</style>
