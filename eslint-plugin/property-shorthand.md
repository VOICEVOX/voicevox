# property-shorthand

このルールでは，プロパティを省略記法で記述することができる場合，必ず省略記法を使うようにします．

```vue
<template>
  <Component :isEnginesReady="isEnginesReady" />
<!--         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ':isEnginesReady="isEnginesReady"'ではなく':isEnginesReady'を使用してください。 -->
</template>
```

## リンク

[#1945](https://github.com/VOICEVOX/voicevox/issues/1945)
