import { onMounted, onActivated, onDeactivated, onUnmounted } from "vue";

/**
 * onMountedかonActivatedのどちらかが呼ばれた時に実行される関数を登録する。
 *
 * NOTE:
 * 大抵の場合はonMountedのあとにonActivatedが必ず呼ばれるが、
 * KeepAliveでonActivatedが呼ばれるべきタイミングを過ぎた後、
 * v-ifなどで切り替わるとonMountedのみが呼ばれる場合がある。
 * このケースに対応している。
 */
export const onMountedOrActivated = (hook: () => void) => {
  let shouldCall = true;

  const start = () => {
    if (shouldCall) {
      hook();
      shouldCall = false;
    }
  };
  onMounted(start);
  onActivated(start);

  const stop = () => {
    shouldCall = true;
  };
  onDeactivated(stop);
  onUnmounted(stop);
};

/**
 * onUnmountedかonDeactivatedのどちらかが呼ばれた時に実行される関数を登録する。
 */
export const onUnmountedOrDeactivated = (hook: () => void) => {
  let shouldCall = false;

  const start = () => {
    shouldCall = true;
  };
  onMounted(start);
  onActivated(start);

  const stop = () => {
    if (shouldCall) {
      hook();
      shouldCall = false;
    }
  };
  onUnmounted(stop);
  onDeactivated(stop);
};
