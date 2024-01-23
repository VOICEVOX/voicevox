import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import SingerHome from "../views/SingerHome.vue";
import EditorHome from "../views/EditorHome.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/talk",
    component: EditorHome,
  },
  {
    path: "/song",
    component: SingerHome,
  },
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
