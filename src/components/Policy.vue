<template>
  <div class="root">
    <mcw-top-app-bar>
      <div class="mdc-top-app-bar__row">
        <section
          class="mdc-top-app-bar__section mdc-top-app-bar__section--align-start"
        >
          <span class="mdc-top-app-bar__title">ソフトウェアの利用規約</span>
        </section>
      </div>
    </mcw-top-app-bar>
    <div
      class="scroller mdc-top-app-bar--fixed-adjust relarive-absolute-wrapper"
    >
      <div>
        <section>
          <p>ダミー利用規約</p>
        </section>
        <section>
          <h3>禁止事項</h3>
          <ul>
            <li>ダミー禁止事項</li>
          </ul>
        </section>
        <section>
          <h3>免責事項</h3>
          <p>ダミー免責事項</p>
        </section>
        <section>
          <h3>その他</h3>
          <p>ダミーその他</p>
        </section>
        <section>
          <h3>謝辞</h3>
          <p>ダミー謝辞</p>
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
