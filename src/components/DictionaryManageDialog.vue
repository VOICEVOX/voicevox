<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog"
    v-model="dictionaryManageDialogOpenedComputed"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-background">
      <q-page-container class="root">
        <q-header class="q-pa-sm">
          <q-toolbar>
            <q-toolbar-title class="text-display">辞書管理</q-toolbar-title>
            <q-space />
            <!-- close button -->
            <q-btn
              round
              flat
              icon="close"
              color="display"
              @click="dictionaryManageDialogOpenedComputed = false"
            />
          </q-toolbar>
        </q-header>
        <q-page class="row">
          <div v-if="loadingDict" class="loading-dict">
            <div>
              <q-spinner color="primary" size="2.5rem" />
              <div class="q-mt-xs">読み込み中・・・</div>
            </div>
          </div>
          <div class="col-4 word-list-col">
            <div class="text-h5 q-pa-sm">単語一覧</div>
            <q-list class="word-list">
              <q-item
                v-for="(value, key) in userDict"
                :key="key"
                tag="label"
                v-ripple
              >
                <q-item-section>
                  <q-item-label>{{ value.surface }}</q-item-label>
                  <q-item-label caption>{{ value.yomi }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <div class="col-8" />
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from "vue";
import { useStore } from "@/store";
import { toDispatchResponse } from "@/store/audio";
import { UserDictWord } from "@/openapi";

export default defineComponent({
  name: "DictionaryManageDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();

    let engineInfo: EngineInfo | undefined;
    const dictionaryManageDialogOpenedComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });
    const loadingDict = ref(false);
    const userDict = ref<{ [key: string]: UserDictWord }>({});

    watch(dictionaryManageDialogOpenedComputed, async (newValue) => {
      if (newValue) {
        engineInfo = store.state.engineInfos[0]; // TODO: 複数エンジン対応
        if (!engineInfo)
          throw new Error(`No such engineInfo registered: index == 0`);
        loadingDict.value = true;
        userDict.value = await store
          .dispatch("INVOKE_ENGINE_CONNECTOR", {
            engineKey: engineInfo.key,
            action: "getUserDictWordsUserDictGet",
            payload: [],
          })
          .then(toDispatchResponse("getUserDictWordsUserDictGet"));
        loadingDict.value = false;
      }
    });

    return {
      dictionaryManageDialogOpenedComputed,
      userDict,
      loadingDict,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles/colors' as colors;
@use '@/styles/variables' as vars;

.word-list-col {
  border-right: solid 1px colors.$setting-item;
}

.word-list {
  // menubar-height + header-height + window-border-width
  // 46(title)
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width + 46px}
  );
  width: 100%;
  overflow-y: scroll;
}

.loading-dict {
  background-color: rgba(colors.$display-dark-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display-dark;
    background: colors.$background-light;
    border-radius: 6px;
    padding: 14px;
  }
}
</style>
