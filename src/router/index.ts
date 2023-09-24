<<<<<<< HEAD
import {
  createRouter,
  createWebHistory,
  createWebHashHistory,
  RouteRecordRaw,
} from "vue-router";
import SingerHome from "../views/SingerHome.vue";
=======
import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
>>>>>>> main
import EditorHome from "../views/EditorHome.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/home",
    component: EditorHome,
    props: (route) => ({ projectFilePath: route.query["projectFilePath"] }),
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
