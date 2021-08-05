<template>
  <router-view />
</template>

<style lang="scss">
@use '@/styles' as global;

@use '@material/theme' with (
  $primary: global.$primary,
  $on-primary: global.$on-primary,
);

@use '@material/button/styles' as buttonStyles;
@use '@material/button';
@use "@material/textfield/mdc-text-field";
@use "@material/top-app-bar/mdc-top-app-bar";
@use "@material/slider/styles" as sliderStyles;
@use "@material/fab/mdc-fab";
@use "@material/tab/mdc-tab";
@use "@material/tab-bar/mdc-tab-bar";
@use "@material/tab-indicator/mdc-tab-indicator";
@use "@material/tab-scroller/mdc-tab-scroller";
@use "@material/list/mdc-list";
@use "@material/menu/mdc-menu";
@use "@material/menu-surface/mdc-menu-surface";
@use "@material/circular-progress/mdc-circular-progress";
@use "@material/drawer/mdc-drawer";
@use "@material/icon-button/mdc-icon-button";

#app {
  display: flex;
  flex-direction: column;
}
</style>
