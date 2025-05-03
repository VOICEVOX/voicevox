# PR #2557 のレビュー分析と実装方針

## PR概要

PR #2557「refactor: installVvppEngineをthrowする形に変更」は、エラーハンドリング機構の改善を目的としています。主な変更点：

1. `installVvppEngine`と`uninstallVvppEngine`関数がエラー発生時にbooleanを返す代わりに例外をthrowするよう変更
2. IPC通信においてエラーメッセージを正しく伝達するための仕組み（ラップ・アンラップ機構）を追加
3. エラーハンドリングの設計方針をドキュメント化

## バックグラウンド（関連issue）

- **Issue #1086**: TypeScript＋UIでのエラーハンドリングに関する議論

  - throwとResult型の使い分けについての検討
  - 返り値が必要な場合はResult型、返り値が不要な場合はthrowの方針に決定
  - エラーメッセージの表示方法に関する議論

- **Issue #1194**: エンジン関連の大規模リファクタリング計画（直接的な関連はやや弱い）
  - VOICEVOXのエンジン部分をVVPPとして分離する計画
  - エラーハンドリングの重要性が増す背景

## PR内容の詳細分析

### 1. 例外をthrowする形式への変更

変更前：

- `installVvppEngine`と`uninstallVvppEngine`関数はエラー発生時に自身でダイアログを表示し、booleanを返していた
- ダイアログ表示のロジックが関数内に埋め込まれていて再利用が難しかった

変更後：

- 関数はエラー時に例外をthrowするだけの形に変更
- 呼び出し側でcatch・ハンドリングすることで柔軟な対応が可能に
- エラーメッセージはcause付きのErrorオブジェクトとして伝播

### 2. IPC通信でのエラーハンドリング改善

- 新規ファイル`ipcResultHelper.ts`の追加
  - `wrapToIpcResult`: 処理をラップし、結果をオブジェクト形式で返す
  - `getOrThrowIpcResult`: オブジェクト形式の結果を解析し、エラー時に例外をthrow
- electron.ipcRendererとmainプロセス間でエラーメッセージが正しく伝達できるようになった

### 3. エラーハンドリングに関するドキュメント更新

- `docs/UX・UIデザインの方針.md`: エラーダイアログの文面に関する規定を追加
- `docs/細かい設計方針.md`: エラーハンドリングの方針について「実験的運用中」として記述

## レビューコメントへの対応

sevenc-nanashiさんからのレビューコメントが2つありました：

1. **IPC通信でエラーの型情報が失われる問題**:

   - 現状の`ipcResultHelper.ts`の実装では、DisplayableErrorと通常のErrorの区別が失われる可能性がある
   - 対応策: `wrapToIpcResult`関数でエラーの型情報を保持する方法を検討する
     - 可能であれば`errorToMessage`内でDisplayableErrorを特別扱いする
     - または、IPC通信でもエラータイプを識別できるよう拡張する

2. **ドキュメントへのDisplayableErrorの追記**:
   - `docs/細かい設計方針.md`のエラーハンドリングセクションにDisplayableErrorについて言及する
   - ユーザーに表示される例外とシステム内部のエラーの区別について明確に記述する

## 実装方針

現在のコードベースにPR #2557の内容を反映するにあたり、以下の方針で進めます：

1. **エラーハンドリング関連のファイル反映**

   - `errorHelper.ts`はすでに存在し、`errorToMessage`関数も実装されているため、それを利用
   - 新規の`ipcResultHelper.ts`ファイルを追加・実装
   - DisplayableErrorの型情報保持に対応するよう実装を調整

2. **関連するファイルの修正**

   - `engineAndVvppController.ts`: installVvppEngine/uninstallVvppEngineを例外をthrowする形に変更
   - `ipc.ts`: wrapToIpcResultによるエラーハンドリング改善
   - `ipcMainHandle.ts`: 返り値の型を調整
   - `preload.ts`: getOrThrowIpcResultを使ったエラーハンドリング実装
   - `EngineManageDialog.vue`: エラーハンドリングロジックの修正

3. **テストの追加**

   - `ipcResultHelper.node.spec.ts`ファイルを追加し、ラップ・アンラップ機能のテストを実装
   - DisplayableErrorのテストケースも追加

4. **型定義の更新**

   - `type.ts`, `ipc.ts`, `preload.ts`での関連する型の更新

5. **ドキュメント更新**
   - 設計ドキュメントにエラーハンドリング方針の追記
   - DisplayableErrorの役割と使用方法について明記

## 実装スケジュール

1. まず`ipcResultHelper.ts`ファイルの実装（DisplayableErrorの型情報保持に対応）
2. 各コンポーネントでのエラーハンドリングの修正
3. テストの追加・実装（DisplayableErrorのテストケースを含む）
4. ドキュメント更新（DisplayableErrorについての説明を追加）

## 次のステップ

PRの内容を理解し、sevenc-nanashiさんのレビューコメントを考慮した実装計画を準備しました。次は実際にコードの変更を行っていきます。特にDisplayableErrorの型情報が失われない形での実装に注意します。
