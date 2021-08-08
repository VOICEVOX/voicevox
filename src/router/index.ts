import {
  createRouter,
  createWebHistory,
  createWebHashHistory,
  RouteRecordRaw,
} from "vue-router";
import Home from "../views/Home.vue";
import Help from "../views/Help.vue";
import Policy from "../components/Policy.vue";
import LibraryPolicy from "../components/LibraryPolicy.vue";
import HowToUse from "../components/HowToUse.vue";
import OssLicense from "../components/OssLicense.vue";
import UpdateInfo from "../components/UpdateInfo.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/home",
    component: Home,
  },
  {
    path: "/help",
    component: Help,
    children: [
      {
        path: "/help/policy",
        component: Policy,
      },
      {
        path: "/help/library-policy",
        component: LibraryPolicy,
      },
      {
        path: "/help/how-to-use",
        component: HowToUse,
      },
      {
        path: "/help/oss-license",
        component: OssLicense,
      },
      {
        path: "/help/update-info",
        component: UpdateInfo,
      },
    ],
  },
];

const router = createRouter({
  history: process.env.IS_ELECTRON
    ? createWebHashHistory(process.env.BASE_URL)
    : createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
