import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
  RouteRecordRaw,
} from "vue-router";
import EditorHome from "../views/EditorHome.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    component: EditorHome,
    props: (route) => ({ projectFilePath: route.query["projectFilePath"] }),
  },
];

const router = createRouter({
  history:
    import.meta.env.VITE_IS_ELECTRON === "true"
      ? createWebHashHistory(import.meta.env.BASE_URL)
      : createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
