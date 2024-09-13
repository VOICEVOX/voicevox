<template>
  <div class="container">
    <BaseScrollArea>
      <div class="inner">
        <BaseDocumentView>
          <h1>アップデート履歴</h1>
          <div v-if="props.isUpdateAvailable" class="info">
            <div class="info-title">
              最新バージョン {{ props.latestVersion }} が見つかりました
            </div>
            <a :href="props.downloadLink" target="_blank">ダウンロードページ</a>
          </div>
          <template
            v-for="(info, infoIndex) of props.updateInfos"
            :key="infoIndex"
          >
            <h2>バージョン {{ info.version }}</h2>
            <ul>
              <li
                v-for="(item, descriptionIndex) of info.descriptions"
                :key="descriptionIndex"
              >
                {{ item }}
              </li>
            </ul>
            <h3 v-if="info.contributors.length > 0">貢献者リスト</h3>
            <p>
              <template
                v-for="(item, contributorIndex) of info.contributors"
                :key="contributorIndex"
              >
                <span v-if="contributorIndex > 0"> / </span>
                <a :href="`https://github.com/${item}`" target="_blank">
                  {{ item }}
                </a>
              </template>
            </p>
          </template>
        </BaseDocumentView>
      </div>
    </BaseScrollArea>
  </div>
</template>

<script setup lang="ts">
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import BaseDocumentView from "@/components/Base/BaseDocumentView.vue";
import { UpdateInfo } from "@/type/preload";

const props = defineProps<{
  latestVersion: string;
  downloadLink: string;
  updateInfos: UpdateInfo[];
  isUpdateAvailable: boolean;
}>();
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

.container {
  height: 100%;
}

.inner {
  padding: vars.$padding-2;
  max-width: 960px;
  margin: auto;
}

.info {
  border: 1px solid colors.$border;
  background-color: colors.$surface;
  padding: vars.$padding-2;
  border-radius: vars.$radius-2;
}

.info-title {
  @include mixin.headline-2;
}
</style>
