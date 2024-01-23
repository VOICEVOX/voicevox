import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import SingerHome from "../views/SingerHome.vue";
import EditorHome from "../views/EditorHome.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/home",
    component: EditorHome,
  },
  {
    path: "/singer-home",
    component: SingerHome,
  },
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
