# android/app/src/main/jniLibs

このディレクトリにはそれぞれのアーキテクチャの外部ライブラリが入ります。
以下のように配置して下さい。

```yml
jniLibs:
  include:
    voicevox_core.h
  x86_64:
    .gitkeep
    libvoicevox_core.so
    ...
  arm64-v8a:
    .gitkeep
    libvoicevox_core.so
    ...
```

| ライブラリ | ダウンロードリンク                                                    |
| ---------- |--------------------------------------------------------------|
| [VOICEVOX CORE](https://github.com/voicevox/voicevox_core)  | https://github.com/VOICEVOX/voicevox_core/releases/tag/0.14.3 |

