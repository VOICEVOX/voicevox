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
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
