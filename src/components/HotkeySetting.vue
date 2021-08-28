<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar>
        <q-toolbar-title class="text-secondary"
          >ショートカットキーの設定</q-toolbar-title
        >
      </q-toolbar>
    </q-header>
    <q-page class="relarive-absolute-wrapper scroller">
      <q-table
        flat
        class="hotkey-table"
        :rows="rows"
        :columns="columns"
        :rows-per-page-options="[]"
        row-key="action"
        sq
      >
        <template v-slot:body="props">
          <q-tr :props="props">
            <q-td key="action" :props="props">
              {{ props.row.action }}
            </q-td>
            <q-td
              key="combination"
              :props="props"
              :id="props.row.id"
              @click="handleRecording($event, props.row.id)"
              @dblclick="removeHotkey($event, props.row.id)"
            >
              {{
                props.row.combination === "" ? "未設定" : props.row.combination
              }}
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-page>
  </div>
</template>

<script lang="ts">
import { useStore } from "@/store";
import { computed, defineComponent, ref } from "vue";
import { GET_HOTKEY_SETTING, SET_HOTKEY_SETTING } from "@/store/setting";
import { HotkeySetting } from "@/store/type";

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

    store.dispatch(GET_HOTKEY_SETTING);

    const hotkey_rows = computed(() => store.state.hotkeySetting);

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
      hotkey_rows.value[id].combination = combination;
      store.dispatch(SET_HOTKEY_SETTING, {
        combination: combination,
        id: id,
      });
    };

    return {
      rows: ref(hotkey_rows.value),
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
