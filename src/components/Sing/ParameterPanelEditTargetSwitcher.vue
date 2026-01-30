<template>
  <QBtnGroup flat class="edit-target-switcher">
    <!-- 音素タイミング -->
    <QBtn
      dense
      unelevated
      class="segment-switch"
      :class="{ active: editTarget === 'PHONEME_TIMING' }"
      @click="changeEditTarget('PHONEME_TIMING')"
    >
      <QIcon name="access_time" size="20px" />
      <QTooltip
        :delay="500"
        anchor="bottom middle"
        transitionShow=""
        transitionHide=""
      >
        音素タイミング編集
      </QTooltip>
    </QBtn>

    <!-- ボリューム -->
    <QBtn
      dense
      unelevated
      class="segment-switch"
      :class="{ active: editTarget === 'VOLUME' }"
      @click="changeEditTarget('VOLUME')"
    >
      <QIcon name="volume_down" size="20px" />
      <QTooltip
        :delay="500"
        anchor="bottom middle"
        transitionShow=""
        transitionHide=""
      >
        ボリューム編集
      </QTooltip>
    </QBtn>
  </QBtnGroup>
</template>

<script setup lang="ts">
import { ParameterPanelEditTarget } from "@/store/type";

defineProps<{
  editTarget: ParameterPanelEditTarget;
  changeEditTarget: (editTarget: ParameterPanelEditTarget) => void;
}>();
</script>

<style scoped lang="scss">
.edit-target-switcher {
  border: 1px solid var(--scheme-color-outline-variant);
  box-sizing: border-box;
  padding: 3px;
  height: 40px;
  border-radius: 20px;
}

.segment-switch {
  color: var(--scheme-color-on-surface-variant);
  height: 32px;
  min-width: 32px;
  border-radius: 16px !important;

  &.active {
    background: var(--scheme-color-secondary-container);
    color: var(--scheme-color-on-secondary-container);
  }
}
</style>
