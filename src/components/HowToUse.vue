<template>
  <div class="root">
    <mcw-top-app-bar>
      <div class="mdc-top-app-bar__row">
        <section
          class="mdc-top-app-bar__section mdc-top-app-bar__section--align-start"
        >
          <span class="mdc-top-app-bar__title">使い方</span>
        </section>
      </div>
    </mcw-top-app-bar>
    <div
      class="scroller mdc-top-app-bar--fixed-adjust relarive-absolute-wrapper"
    >
      <div>
        <section>
          <p>ソフトウェアの使い方は以下をご参照ください。</p>
          <p>
            <a
              href="https://docs.google.com/document/d/1KvzVrS5aHzZ78chLZ3BbAnyZKvkMG79_4aAlciUJ48U/edit?usp=sharing"
              target="_blank"
              >使い方</a
            >
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script lang="ts"></script>

<style scoped lang="scss">
.root {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.scroller {
  width: 100%;
  overflow: auto;
  > div {
    margin: 1rem;
  }
}
</style>
