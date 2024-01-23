<template>
  <q-menu
    :model-value="isRoot ? undefined : isOpen"
    :no-parent-event="!isRoot"
    :anchor="isRoot ? 'top start' : 'top end'"
    :self="isRoot ? 'bottom start' : 'top start'"
    class="character-menu"
    transition-show="none"
    transition-hide="none"
    @before-show="reassignSubMenuOpenBase(-1)"
  >
    <q-item
      v-for="(item, index) in props.items"
      :key="item.id"
      class="q-pa-none"
      :class="item.highlight && 'selected-item'"
    >
      <q-btn-group flat class="col full-width">
        <q-btn
          v-close-popup
          flat
          no-caps
          class="col-grow"
          @click="onSelect(item.id)"
          @mouseover="reassignSubMenuOpen(-1)"
          @mouseleave="reassignSubMenuOpen.cancel()"
        >
          <q-avatar rounded size="2rem" class="q-mr-md">
            <q-img no-spinner no-transition :ratio="1" :src="item.icon" />
            <q-avatar v-if="item.subIcon" class="sub-icon" rounded>
              <img :src="item.subIcon" />
            </q-avatar>
          </q-avatar>
          <div>{{ item.label }}</div>
        </q-btn>
        <template v-if="item.items && item.items.length > 0">
          <q-separator vertical />

          <div
            class="flex items-center q-px-sm q-py-none cursor-pointer"
            :class="item.highlight && 'highlight'"
            role="application"
            :aria-label="item.treeAlt"
            tabindex="0"
            @mouseover="reassignSubMenuOpen(index)"
            @mouseleave="reassignSubMenuOpen.cancel()"
            @keyup.right="reassignSubMenuOpen(index)"
          >
            <q-icon name="keyboard_arrow_right" color="grey-6" size="sm" />
            <character-tree
              v-model="subMenuOpenFlags[index]"
              :items="item.items"
              @select="onChildSelect([item.id, ...$event])"
            />
          </div>
        </template>
      </q-btn-group>
    </q-item>
  </q-menu>
</template>

<script setup lang="ts">
import { debounce, QBtn } from "quasar";
import { Ref, ref } from "vue";

export type ButtonData = {
  id: string;
  icon: string;
  subIcon?: string | undefined;
  label: string;
  treeAlt: string;
  highlight?: boolean;
  items?: ButtonData[];
};

const props =
  defineProps<{
    items: ButtonData[];
    isRoot?: boolean;
  }>();
const emit =
  defineEmits<{
    (event: "select", id: string[]): void;
  }>();

const isOpen = defineModel<boolean | undefined>(undefined);

const onSelect = (id: string) => {
  emit("select", [id]);
};
const onChildSelect = (id: string[]) => {
  emit("select", id);
};

const subMenuOpenFlags = ref([...Array(props.items.length)].map(() => false));

const reassignSubMenuOpenBase = (idx: number) => {
  if (subMenuOpenFlags.value[idx]) return;
  const arr = [...Array(props.items.length)].map(() => false);
  arr[idx] = true;
  subMenuOpenFlags.value = arr;
};
const reassignSubMenuOpen = debounce(reassignSubMenuOpenBase, 100);
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;
.character-menu {
  .character-item-container {
    display: flex;
    flex-direction: column;
  }

  .q-item {
    color: colors.$display;
  }

  .q-btn-group {
    > .q-btn:first-child > :deep(.q-btn__content) {
      justify-content: flex-start;
    }

    > div:last-child:hover {
      background-color: rgba(colors.$primary-rgb, 0.1);
    }
  }

  .highlight {
    background-color: rgba(colors.$primary-rgb, 0.2);
  }

  .sub-icon {
    position: absolute;
    width: 13px;
    height: 13px;
    bottom: -6px;
    right: -6px;
  }
}
</style>
