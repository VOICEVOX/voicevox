import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import SingHome from "../components/Sing/EditorHome.vue";
import TalkHome from "@/components/Talk/EditorHome.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/talk",
    component: TalkHome,
  },
  {
    path: "/song",
    component: SingHome,
  },
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
