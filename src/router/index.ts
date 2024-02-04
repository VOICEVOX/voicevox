import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import SingEditorHome from "../components/Sing/EditorHome.vue";
import TalkEditorHome from "@/components/Talk/EditorHome.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/talk",
    component: TalkEditorHome,
  },
  {
    path: "/song",
    component: SingEditorHome,
  },
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
