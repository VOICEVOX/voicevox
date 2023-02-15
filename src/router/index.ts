import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import EditorHome from "../views/EditorHome.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/home",
    component: EditorHome,
    props: (route) => ({ projectFilePath: route.query["projectFilePath"] }),
  },
];

const router = createRouter({
  // FIXME: Viteで同じことをする方法を調べる
  // history: process.env.IS_ELECTRON
  //   ? createWebHashHistory(process.env.BASE_URL)
  //   : createWebHistory(process.env.BASE_URL),
  history: createWebHashHistory("/"),
  routes,
});

export default router;
