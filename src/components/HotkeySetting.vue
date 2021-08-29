<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar>
        <q-toolbar-title class="text-secondary"
          >ショートカットキーの設定</q-toolbar-title
        >
      </q-toolbar>
    </q-header>
    <q-page-container>
      <q-page class="relative-absolute-wrapper scroller">
        <p v-for="n in 15" :key="n">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Fugit nihil
          praesentium molestias a adipisci, dolore vitae odit, quidem
          consequatur optio voluptates asperiores pariatur eos numquam rerum
          delectus commodi perferendis voluptate?
        </p>
      </q-page>
    </q-page-container>
  </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { computed, defineComponent, ref, toRaw } from "vue";
import { SET_HOTKEY_SETTING } from "@/store/setting";
import { Store } from "vuex";

const columns = [
  {
    name: "action",
    align: "left",
    label: "操作",
    field: "action",
  },
  {
    name: "combination",
    align: "right",
    label: "ショートカットキー",
    field: "combination",
  },
];

export default defineComponent({
  name: "HotkeySetting",
  setup() {
    const store = useStore();
    let lastHotkey: string | null = null;
    let lastRecord = "";

    const hotkey_rows = ref(computed(() => store.state.hotkeySetting));

    // const hotkey_rows = computed(() => [
    //   {
    //     id: "1",
    //     action: "save_audio",
    //     combination: "Ctrl E",
    //   },
    //   {
    //     id: "2",
    //     action: "save_single_audio",
    //     combination: "Ctrl O",
    //   },
    //   {
    //     id: "3",
    //     action: "play/stop",
    //     combination: "SPACE",
    //   },
    //   {
    //     id: "4",
    //     action: "switch_into",
    //     combination: "2",
    //   },
    // ]);
    const handleRecording = (event: MouseEvent, id: string) => {
      if (event.target instanceof HTMLElement) {
        if (lastHotkey === null) {
          lastRecord = event.target.innerHTML;
          lastHotkey = id;
          event.target.style.color = "grey";
        } else if (lastHotkey != id) {
          return;
        } else {
          changeHotkey(lastHotkey, lastRecord);
          lastHotkey = null;
          event.target.style.color = "black";
        }
      }
    };

    const recordCombination = (event: KeyboardEvent) => {
      if (lastHotkey === null) {
        return;
      } else {
        let recorded = "";
        if (event.altKey) {
          recorded += "Alt ";
        }
        if (event.ctrlKey) {
          recorded += "Ctrl ";
        }
        if (event.shiftKey) {
          recorded += "Shift ";
        }
        if (event.key === " ") {
          recorded += "Space";
        } else {
          recorded += event.key.toUpperCase();
        }
        const hotkey = document.getElementById(lastHotkey);
        if (hotkey instanceof HTMLElement) {
          hotkey.style.color = "teal";
          hotkey.innerHTML = recorded;
          lastRecord = recorded;
        }
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", recordCombination);

    const removeHotkey = (event: MouseEvent, id: string) => {
      changeHotkey(id, "");
    };

    const changeHotkey = (hotkey_id: string, combination: string) => {
      const id = parseInt(hotkey_id) - 1;
      store.dispatch(SET_HOTKEY_SETTING, {
        combination: combination,
        id: id,
      });
    };

    document.addEventListener("keyup", (event: KeyboardEvent) => {
      if (event.key === "p") {
        console.log(hotkey_rows);
        console.log(store.state.hotkeySetting);
      }
    });

    return {
      rows: hotkey_rows,
      columns: ref(columns),
      handleRecording,
      removeHotkey,
    };
  },
});
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}
</style>
