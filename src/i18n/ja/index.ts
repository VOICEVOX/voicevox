export default {
  ISO_name: "ja",
  loc_name: "日本語",
  nav: {
    next: "次へ",
    back: "戻る",
    finish: "完了",
    play: "再生",
    stop: "停止",
  },
  dialogs: {
    play_failed: {
      title: "再生に失敗しました",
      msg: "エンジンの再起動をお試しください。",
      close: "閉じる",
    },
    hotkey_edit: {
      title: "ショートカットキーを入力してください",
      duplicated: "ショートカットキーが次の操作と重複しています",
      duplicated_action: "「{action}」",
      unbind: "ショートカットキーを未設定にする",
      cancel: "キャンセル",
      confirm: "confirm",
      overwrite: "上書きする",
    },
    hotkey_restore: {
      title: "ショートカットキーを初期値に戻します",
      msg: "{action}のショートカットキーを初期値に戻します。<br/>本当に戻しますか？",
      confirm: "初期値に戻す",
      close: "初期値に戻さない",
    },
    error_no_cell: {
      title: "テキスト欄が選択されていません",
      msg: "音声を書き出したいテキスト欄を選択してください。",
      close: "閉じる",
    },
    export_failed: {
      title: "書き出しに失敗しました。",
      write_error_msg:
        "書き込みエラーによって失敗しました。空き容量があることや、書き込み権限があることをご確認ください。",
      engine_error_msg:
        "エンジンのエラーによって失敗しました。エンジンの再起動をお試しください。",
      close: "閉じる",
    },
    save_result: {
      title: "音声書き出し結果",
      write_error: "失敗（書き込みエラー）：",
      engine_error: "失敗（エンジンエラー）：",
      success: "成功：",
      close: "閉じる",
    },
    change_engine_mode: {
      title: "エンジンの起動モードを変更しました",
      write_error: "変更を適用するためにエンジンを再起動します。",
    },
    changing_engine_mode: {
      msg: "起動モードを変更中です",
    },
    error_gpu_not_found: {
      title: "対応するGPUデバイスが見つかりません",
      write_error:
        "GPUモードの利用には、メモリが3GB以上あるNVIDIA製GPUが必要です。<br />このままGPUモードに変更するとエンジンエラーが発生する可能性があります。本当に変更しますか？",
      confirm: "変更する",
      close: "変更しない",
    },
    warning_sample_rate: {
      title: "出力サンプリングレートを変更します",
      msg: "出力サンプリングレートを変更しても、音質は変化しません。また、音声の生成処理に若干時間がかかる場合があります。<br />変更しますか？",
      confirm: "変更する",
      close: "変更しない",
    },
  },
  windows: {
    choose_export_folder: "書き出し先のフォルダを選択",
    save_audio: "音声を保存",
    save_all_audio: "音声を全て保存",
    error_audio_device_not_found: {
      title: "エラー",
      msg: "再生デバイスが見つかりません",
    },
    warning_project_overwrite: {
      title: "警告",
      msg: "プロジェクトの変更が保存されていません。\n変更を破棄してもよろしいですか？",
      confirm: "破棄",
      close: "キャンセル",
    },
    open_project: "プロジェクトファイルの選択",
    save_project: "プロジェクトファイルの保存",
  },
  errors: {
    invalid_project_file: "VOICEVOX Project file {filePath} is a invalid file.",
    app_version_mismatch:
      "An invalid appVersion format. The appVersion should be in the format %d.%d.%d",
    app_version_type_error:
      "The appVersion of the project file should be string",
    file_format_error: "ファイルフォーマットが正しくありません。",
    any: "エラーが発生しました。",
  },
  home: {
    starting_engine: "エンジン起動中・・・",
  },
  audio_detail: {
    accent: "ｱｸｾﾝﾄ",
    pitch: "ｲﾝﾄﾈｰｼｮﾝ",
    length: "長さ",
  },
  audio_cell: {
    msg_length_error:
      "文章が長いと正常に動作しない可能性があります。\n句読点の位置で文章を分割してください。",
  },
  audio_info: {
    speed_scale: "話速",
    pitch_scale: "音高",
    into_scale: "抑揚",
    volume_scale: "音量",
    prefix_silence: "開始無音",
    suffix_silence: "終了無音",
  },
  header_bar: {
    play: "連続再生",
    stop: "停止",
    undo: "元に戻す",
    redo: "やり直す",
  },
  help_dialog: {
    root: "ヘルプ",
    policy: "ソフトウェアの利用規約",
    library_policy: "音声ライブラリの利用規約",
    how_to_use: "使い方",
    community: "開発コミュニティ",
    license: "ライセンス情報",
    release_note: "アップデート情報",
  },
  hotkey_dialog: {
    root: "設定",
    title: "キー割り当て",
    search: "検索",
    restore: "デフォルトに戻す",
    action: "操作",
    combination: "ショートカットキー",
    read_only: "読み取り専用",
    blank: "未設定",
  },
  default_style: {
    root: "設定",
    title: "デフォルトスタイル・試聴",
    choose: "デフォルトのスタイル（喋り方）を選んでください",
    listen: "サンプル音声を視聴できます",
    tip: "※後からでも変更できます",
    normal: "ノーマル",
  },
  menu_bar: {
    file: {
      label: "ファイル",
      new_project: "新規プロジェクト",
      export_audio: "音声書き出し",
      export_one_audio: "一つだけ書き出し",
      read_text_file: "テキスト読み込み",
      save_project: "プロジェクトを上書き保存",
      save_project_as: "プロジェクトを名前を付けて保存",
      open_project: "プロジェクト読み込み",
    },
    engine: {
      label: "エンジン",
      restart: "再起動",
    },
    setting: {
      label: "設定",
      hotkeys: "キー割り当て",
      default_styles: "デフォルトスタイル・試聴",
      general: "オプション",
    },
    help: {
      label: "ヘルプ",
    },
    pin_tip: "最前面に表示",
  },
  setting_dialog: {
    root: "設定",
    title: "オプション",
    engine: {
      title: "エンジン",
      engine_mode: {
        label: "エンジンモード",
        tip: "GPUモードの利用には NVIDIA&trade; GPU が必要です",
      },
    },
    operation: {
      title: "操作",
      inherit_parameter: {
        label: "パラメータの引き継ぎ",
        tip: "テキスト欄を追加する際、現在の話速等のパラメータを引き継ぎます",
      },
    },
    saving: {
      title: "保存",
      encoding: {
        label: "文字コード",
      },
      fix_export_dir: {
        label: "書き出し先を固定",
        tip: "音声ファイルを設定したフォルダに書き出す",
        input_label: "書き出し先のフォルダ",
        explore_folder: "フォルダ選択",
      },
      avoid_overwrite: {
        label: "上書き防止",
        tip: "上書きせずにファイルを連番で保存します",
      },
      generate_lab_file: {
        label: "labファイルを生成",
        tip: "リップシンク用のlabファイルを生成します",
      },
      generate_text_file: {
        label: "txtファイルを書き出し",
        tip: "テキストをtxtファイルとして書き出します",
      },
    },
    advanced: {
      title: "高度な設定",
      stereo: {
        label: "音声をステレオ化",
        tip: "音声データをモノラルからステレオに変換してから再生・保存を行います",
      },
      device: {
        label: "再生デバイス",
        select_label: "再生デバイス",
        tip: "音声の再生デバイスを変更し再生を行います",
      },
      sample_rate: {
        label: "音声のサンプリングレート",
        tip: "再生・保存時の音声のサンプリングレートを変更します（サンプリングレートを上げても音声の品質は上がりません。）",
      },
    },
    locale: {
      title: "ローカリゼーション",
      language: {
        label: "言語",
        tip: "表示の言語を選択",
      },
      fallback: {
        label: "フォールバック言語",
        tip: "表示言語にない単語の言語を選択",
      },
      relaunch: {
        label: "再起動",
        tip: "変更を適用ため再起動が必要です",
      },
    },
  },
  hotkey_table: {
    exportAllAudio: "音声書き出し",
    exportAudio: "一つだけ書き出し",
    togglePlayback: "再生/停止",
    togglePlaybackCon: "連続再生/停止",
    showAccent: "ｱｸｾﾝﾄ欄を表示",
    showPitch: "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
    showLength: "長さ欄を表示",
    addCell: "テキスト欄を追加",
    removeCell: "テキスト欄を削除",
    unfocusCell: "テキスト欄からフォーカスを外す",
    refocusCell: "テキスト欄にフォーカスを戻す",
    undo: "元に戻す",
    redo: "やり直す",
    newProj: "新規プロジェクト",
    saveProjAs: "プロジェクトを名前を付けて保存",
    saveProj: "プロジェクトを上書き保存",
    openProj: "プロジェクト読み込み",
    importText: "テキスト読み込む",
  },
};
