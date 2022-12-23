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
            <q-separator spaced v-if="engineIndex > 0" />
            <q-item-label header>{{
              engineInfos.get(engineId).name
            }}</q-item-label>
          </template>
          <template
            v-for="([, characterInfo], characterIndex) in engineInfos.get(
              engineId
            ).characterInfos"
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
            color="primary-light"
            icon="keyboard_arrow_left"
            label="戻る"
            @click="selectCharacterInfo(undefined)"
          />
        </div>
        <div class="text-subtitle">
          {{
            engineInfos
              .get(selectedInfo.engine)
              .characterInfos.get(selectedInfo.character).metas.speakerName
          }}
        </div>
        <div
          class="markdown"
          v-html="
            convertMarkdown(
              engineInfos
                .get(selectedInfo.engine)
                .characterInfos.get(selectedInfo.character).metas.policy
            )
          "
        ></div>
      </div>
    </div>
  </q-page>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { computed, defineComponent, ref } from "vue";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";
import { sortEngineInfos } from "@/helpers/engineHelper";

type DetailKey = { engine: string; character: string };

export default defineComponent({
  setup() {
    const store = useStore();
    const md = useMarkdownIt();

    const allCharacterInfos = computed(
      () => store.getters.GET_ALL_CHARACTER_INFOS
    );

    const sortedEngineInfos = computed(() =>
      sortEngineInfos(Object.values(store.state.engineInfos))
    );

    const engineInfos = computed(
      () =>
        new Map(
          Object.entries(store.state.characterInfos).map(
            ([engineId, characterInfos]) => [
              engineId,
              {
                engineId,
                name: store.state.engineManifests[engineId].name,
                characterInfos: new Map(
                  characterInfos.map((ci) => [ci.metas.speakerUuid, ci])
                ),
              },
            ]
          )
        )
    );

    const convertMarkdown = (text: string) => {
      return md.render(text);
    };

    const selectedInfo = ref<DetailKey | undefined>(undefined);

    const scroller = ref<HTMLElement>();
    const selectCharacterInfo = (index: DetailKey | undefined) => {
      if (scroller.value == undefined)
        throw new Error("scroller.value == undefined");
      scroller.value.scrollTop = 0;
      selectedInfo.value = index;
    };

    return {
      characterInfos: allCharacterInfos,
      engineInfos,
      convertMarkdown,
      sortedEngineInfos,
      selectCharacterInfo,
      selectedInfo,
      scroller,
    };
  },
});
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
