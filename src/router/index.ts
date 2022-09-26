import {
  createRouter,
  createWebHistory,
  createWebHashHistory,
  RouteRecordRaw,
} from "vue-router";
import Home from "../views/Home.vue";
import SingerHome from "../views/SingerHome.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/home",
    component: Home,
  },
  {
    path: "/singer-home",
    component: SingerHome,
  },
];

const router = createRouter({
  history: process.env.IS_ELECTRON
    ? createWebHashHistory(process.env.BASE_URL)
    : createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
