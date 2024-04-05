<template>
  <div v-if="selectedInfo === undefined" class="container">
    <BaseScrollArea>
      <div class="inner inner-list">
        <h1 class="title">音声ライブラリの利用規約</h1>
        <div class="list">
          <template
            v-for="(engineId, engineIndex) in sortedEngineInfos.map(
              (engineInfo) => engineInfo.uuid
            )"
            :key="engineIndex"
          >
            <!-- エンジンが一つだけの場合は名前を表示しない -->
            <h2 v-if="engineInfos.size > 1" class="subtitle">
              {{ mapUndefinedPipe(engineInfos.get(engineId), (v) => v.name) }}
            </h2>
            <BaseRowCard
              v-for="([, characterInfo], characterIndex) in mapUndefinedPipe(
                engineInfos.get(engineId),
                (v) => v.characterInfos
              )"
              :key="characterIndex"
              :title="characterInfo.metas.speakerName"
              clickable
              @click="
                selectCharacterInfo({
                  engine: engineId,
                  character: characterInfo.metas.speakerUuid,
                })
              "
            >
              <!-- 暫定でq-iconを使用 -->
              <q-icon name="keyboard_arrow_right" size="sm" />
            </BaseRowCard>
          </template>
        </div>
      </div>
    </BaseScrollArea>
  </div>
  <div v-else class="container container-detail">
    <BaseScrollArea>
      <div class="inner">
        <div>
          <BaseButton
            label="戻る"
            icon="keyboard_arrow_left"
            @click="selectCharacterInfo(undefined)"
          />
        </div>
        <h1 class="title">
          {{
            mapUndefinedPipe(
              engineInfos.get(selectedInfo.engine),
              (v) => v.characterInfos,
              (v) => mapUndefinedPipe(selectedInfo, (i) => v.get(i.character)),
              (v) => v.metas.speakerName
            )
          }}
        </h1>
        <BaseDocumentView>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-if="policy" class="markdown" v-html="policy"></div>
        </BaseDocumentView>
      </div>
    </BaseScrollArea>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import BaseRowCard from "../base/BaseRowCard.vue";
import BaseScrollArea from "../base/BaseScrollArea.vue";
import BaseButton from "../base/BaseButton.vue";
import BaseDocumentView from "../base/BaseDocumentView.vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";
import { EngineId, SpeakerId } from "@/type/preload";
import { mapUndefinedPipe } from "@/helpers/map";

type DetailKey = { engine: EngineId; character: SpeakerId };

const store = useStore();
const md = useMarkdownIt();

const sortedEngineInfos = computed(() => store.getters.GET_SORTED_ENGINE_INFOS);

const engineInfos = computed(
  () =>
    new Map(
      Object.entries(store.state.characterInfos).map(
        ([engineIdStr, characterInfos]) => {
          const engineId = EngineId(engineIdStr);
          return [
            engineId,
            {
              engineId,
              name: store.state.engineManifests[engineId].name,
              characterInfos: new Map(
                characterInfos.map((ci) => [ci.metas.speakerUuid, ci])
              ),
            },
          ];
        }
      )
    )
);

const policy = computed<string | undefined>(() => {
  if (selectedInfo.value == undefined) return undefined;

  const engineInfo = engineInfos.value.get(selectedInfo.value.engine);
  if (engineInfo == undefined) return undefined;

  const characterInfo = engineInfo.characterInfos.get(
    selectedInfo.value.character
  );
  if (characterInfo == undefined) return undefined;

  return md.render(characterInfo.metas.policy);
});

const selectedInfo = ref<DetailKey | undefined>(undefined);
const selectCharacterInfo = (index: DetailKey | undefined) => {
  selectedInfo.value = index;
};
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/mixin' as mixin;
@use '@/styles/new-colors' as colors;

.container {
  // TODO: 親コンポーネントからheightを取得できないため一時的にcalcを使用、HelpDialogの構造を再設計後100%に変更する
  // height: 100%;
  height: calc(100vh - 90px);
}

.container-detail {
  background-color: colors.$surface;
  border-left: 1px solid colors.$border;
}

.inner {
  display: flex;
  flex-direction: column;
  padding: vars.$padding-2;
  gap: vars.$gap-1;
  max-width: 960px;
  margin: auto;
}

.title {
  @include mixin.headline-1;
}

.subtitle {
  @include mixin.headline-2;
}

.list {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
}
</style>
