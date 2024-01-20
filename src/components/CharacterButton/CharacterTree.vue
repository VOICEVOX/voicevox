<template>
  <q-menu
    :model-value="isOpen"
    class="character-menu"
    transition-show="none"
    transition-hide="none"
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
import { ref } from "vue";

export type ButtonData = {
  id: string;
  icon: string;
  subIcon?: string | undefined;
  label: string;
  treeAlt: string;
  highlight?: boolean;
  items?: ButtonData[];
};

const isOpen = defineModel<boolean>();

const props =
  defineProps<{
    items: ButtonData[];
  }>();
const emit =
  defineEmits<{
    (event: "select", id: string[]): void;
  }>();

const onSelect = (id: string) => {
  emit("select", [id]);
};
const onChildSelect = (id: string[]) => {
  emit("select", id);
};

const subMenuOpenFlags = ref([...Array(props.items.length)].map(() => false));

const reassignSubMenuOpen = debounce((idx: number) => {
  if (subMenuOpenFlags.value[idx]) return;
  const arr = [...Array(props.items.length)].map(() => false);
  arr[idx] = true;
  subMenuOpenFlags.value = arr;
}, 100);
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.character-button {
  border: solid 1px;
  border-color: colors.$primary;
  font-size: 0;
  height: fit-content;

  background: colors.$background;

  .icon-container {
    height: 2rem;
    width: 2rem;

    img {
      max-height: 100%;
      max-width: 100%;
      object-fit: scale-down;
    }
  }

  .loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    background-color: rgba(colors.$background-rgb, 0.74);
    display: grid;
    justify-content: center;
    align-content: center;

    svg {
      filter: drop-shadow(0 0 1px colors.$background);
    }
  }
}

.opaque {
  opacity: 1 !important;
}

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
