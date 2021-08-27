<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar>
        <q-toolbar-title class="text-secondary"
          >ショートカットキーの設定</q-toolbar-title
        >
        <q-input
          dark
          dense
          standout
          v-model="text"
          placeholder="Search"
          input-class="text-left"
          class="q-ml-md"
        >
          <template v-slot:append>
            <q-icon v-if="text === ''" name="search" />
            <q-icon
              v-else
              name="clear"
              class="cursor-pointer"
              @click="text = ''"
            />
          </template>
        </q-input>
      </q-toolbar>
    </q-header>
    <q-page class="relarive-absolute-wrapper scroller">
      <q-table
        :rows="rows"
        :columns="columns"
        :rows-per-page-options="[]"
        row-key="action"
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
              @click="handelRecording($event, props.row.id)"
            >
              {{ props.row.combination }}
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-page>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";
import { useStore } from "vuex";

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
const rows = [
  {
    id: "1",
    action: "音声保存",
    combination: "Ctrl+E",
  },
  {
    id: "2",
    action: "プロジェクト保存",
    combination: "Ctrl+S",
  },
];

export default defineComponent({
  name: "HotkeySetting",
  setup() {
    const store = useStore();

    let lastHotkey: string | null = null;
    let lastRecord = "";

    const handelRecording = (event: MouseEvent, id: string) => {
      if (event.target instanceof HTMLElement) {
        if (lastHotkey === null) {
          lastHotkey = id;
          event.target.style.color = "grey";
        } else {
          changeHotkey(parseInt(lastHotkey), lastRecord);
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
          recorded += "Alt+";
        }
        if (event.ctrlKey) {
          recorded += "Ctrl+";
        }
        if (event.shiftKey) {
          recorded += "Shift+";
        }
        recorded += event.key.toUpperCase();
        const hotkey = document.getElementById(lastHotkey);
        if (hotkey instanceof HTMLElement) {
          hotkey.style.color = "green";
          hotkey.innerHTML = recorded;
          lastRecord = recorded;
        }
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", recordCombination);

    const changeHotkey = (hotkey_id: number, combination: string) => {
      store.dispatch("CHANGE_HOTKEY_SETTING", { hotkey_id, combination });
    };

    return {
      rows: ref(rows),
      columns: ref(columns),
      handelRecording,
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
