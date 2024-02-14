import { createRouter, createWebHashHistory, RouteRecordRaw } from "vue-router";
import SingEditor from "@/components/Sing/SingEditor.vue";
import TalkEditor from "@/components/Talk/TalkEditor.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/talk",
    component: TalkEditor,
  },
  {
    path: "/song",
    component: SingEditor,
  },
  { path: "/", redirect: "/talk" },
];

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
