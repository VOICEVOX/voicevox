# UI 名称と Vue ファイル名の対応早見表

## 注意事項など

このファイルは更新漏れなどが発生する可能性が高めです。実際のファイルも併せてご確認ください。

各 UI の名称が分からない場合は、[VOICEVOX 専用 UI の名称](./UX・UIデザインの方針.md#voicevox-専用-ui-の名称) をご覧ください。

## 対応早見

全ファイル共通の拡張子`.vue`は省略しています。

### views ディレクトリ

- メイン画面全体 ･･･ [EditorHome](../src/views/EditorHome.vue)

### compornents ディレクトリ

- 最上部のバー（メニュー含む） ･･･ [MenuBar](../src/components/MenuBar.vue)
  - メニュー
    - メニューの項目リスト ･･･ [MenuItem](../src/components/MenuItem.vue)
    - メニューのボタン ･･･ [MenuButton](../src/components/MenuButton.vue)
    - エンジン
      - エンジンの管理 ･･･ [EngineManageDialog](../src/components/EngineManageDialog.vue)
    - 設定
      - キー割り当て ･･･ [HotkeySettingDialog](../src/components/HotkeySettingDialog.vue)
      - ツールバーのカスタマイズ ･･･ [HeaderBarCustomDialog](../src/components/HeaderBarCustomDialog.vue)
      - キャラクター並び替え・試聴 ･･･ [CharacterOrderDialog](../src/components/CharacterOrderDialog.vue)
        - サンプルボイス一覧の各キャラクター ･･･ [CharacterTryListenCard](../src/components/CharacterTryListenCard.vue)
      - デフォルトスタイル ･･･ [DefaultStyleListDialog](../src/components/DefaultStyleListDialog.vue)
        - 個別選択 ･･･ [DefaultStyleSelectDialog](../src/components/DefaultStyleSelectDialog.vue)
      - 読み方＆アクセント辞書 ･･･ [DictionaryManageDialog](../src/components/DictionaryManageDialog.vue)
      - オプション ･･･ [SettingDialog](../src/components/SettingDialog.vue)
        - 書き出しファイル名パターン ･･･ [FileNamePatternDialog](../src/components/FileNamePatternDialog.vue)
    - ヘルプ ･･･ `help`ディレクトリ
      - [HelpDialog](../src/components/help/HelpDialog.vue) の`pagedata`の`components`をご参照ください。
  - ウィンドウ右上のボタン群（ピンボタン含む） ･･･ [TitleBarButtons](../src/components/TitleBarButtons.vue)
    - ピンボタン以外のボタン ･･･ [MinMaxCloseButtons](../src/components/MinMaxCloseButtons.vue)
- ツールバー ･･･ [HeaderBar](../src/components/HeaderBar.vue)
- キャラクター表示欄 ･･･ [CharacterPortrait](../src/components/CharacterPortrait.vue)
- 台本欄（テキスト欄追加ボタンを含む） ･･･ [views/EditorHome](../src/views/EditorHome.vue) に含まれる
  - レーン（行番号・テキスト欄含む） ･･･ [AudioCell](../src/components/AudioCell.vue)
    - キャラクターアイコン ･･･ [CharacterButton](../src/components/CharacterButton.vue)
    - コンテキスト（右クリック）メニュー ･･･ [ContextMenu](../src/components/ContextMenu.vue)
- パラメータ調整欄 ･･･ [AudioInfo](../src/components/AudioInfo.vue)
  - プリセット管理 ･･･ [PresetManageDialog](../src/components/PresetManageDialog.vue)
- 詳細調整欄（各項目・再生ボタンを含む） ･･･ [AudioDetail](../src/components/AudioDetail.vue)
  - ｱｸｾﾝﾄ項目のうち、文字以外の部分の UI ･･･ [AudioAccent](../src/components/AudioAccent.vue)
  - ｲﾝﾄﾈｰｼｮﾝ・長さ項目のスライダー [AudioParameter](../src/components/AudioParameter.vue)
- その他
  - 初回起動時に表示される画面
    - 利用規約 ･･･ [AcceptTermsDialog](../src/components/AcceptTermsDialog.vue)
    - データ収集とプライバシーポリシー ･･･ [AcceptRetrieveTelemetryDialog](../src/components/AcceptRetrieveTelemetryDialog.vue)
  - 起動時に表示される画面
    - 追加キャラクターの紹介 ･･･ [CharacterOrderDialog](../src/components/CharacterOrderDialog.vue)（設定 / キャラクター並び替え・試聴 と共通）
  - 「音声書き出し」時の成否の通知 ･･･ [SaveAllResultDialog](../src/components/SaveAllResultDialog.vue)
  - 一度のみ表示されるヒント ･･･ [ToolTip](../src/components/ToolTip.vue)
  - 音声生成中の進捗表示 ･･･ [ProgressDialog](../src/components/ProgressDialog.vue)
  - エラー記録用（UI には影響なし） ･･･ [ErrorBoundary](../src/components/ErrorBoundary.vue)
