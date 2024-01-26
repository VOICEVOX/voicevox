<template>
  <q-page
    ref="scroller"
    class="relative-absolute-wrapper scroller bg-background"
  >
    <div class="q-pa-md markdown-body">
      <q-list v-if="selectedInfo === undefined">
        <template
          v-for="(engineId, engineIndex) in sortedEngineInfos.map(
            (engineInfo) => engineInfo.uuid
          )"
          :key="engineIndex"
        >
          <!-- エンジンが一つだけの場合は名前を表示しない -->
          <template v-if="engineInfos.size > 1">
            <q-separator v-if="engineIndex > 0" spaced />
            <q-item-label header>{{
              mapNullablePipe(engineInfos.get(engineId), (v) => v.name)
            }}</q-item-label>
          </template>
          <template
            v-for="([, characterInfo], characterIndex) in mapNullablePipe(
              engineInfos.get(engineId),
              (v) => v.characterInfos
            )"
            :key="characterIndex"
          >
            <q-item
              clickable
              @click="
                selectCharacterInfo({
                  engine: engineId,
                  character: characterInfo.metas.speakerUuid,
                })
              "
            >
              <q-item-section>{{
                characterInfo.metas.speakerName
              }}</q-item-section>
            </q-item>
          </template>
        </template>
      </q-list>
      <div v-else>
        <div class="q-mb-md">
          <q-btn
            outline
            color="primary"
            icon="keyboard_arrow_left"
            label="戻る"
            @click="selectCharacterInfo(undefined)"
          />
        </div>
        <div class="text-subtitle">
          {{
            mapNullablePipe(
              engineInfos.get(selectedInfo.engine),
              (v) => v.characterInfos,
              (v) => mapNullablePipe(selectedInfo, (i) => v.get(i.character)),
              (v) => v.metas.speakerName
            )
          }}
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-if="policy" class="markdown" v-html="policy"></div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";
import { EngineId, SpeakerId } from "@/type/preload";
import { mapNullablePipe } from "@/helpers/map";

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

const scroller = ref<HTMLElement>();
const selectCharacterInfo = (index: DetailKey | undefined) => {
  if (scroller.value == undefined)
    throw new Error("scroller.value == undefined");
  scroller.value.scrollTop = 0;
  selectedInfo.value = index;
};
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
    > div {
      overflow-wrap: break-word;
    }
  }
}
</style>
