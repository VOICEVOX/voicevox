export default {
  ISO_name: "en",
  loc_name: "English",
  nav: {
    next: "Next",
    back: "Back",
    finish: "Finish",
  },
  dialogs: {
    play_failed: {
      title: "Failed to play",
      msg: "Please restart the engine and try again",
      close: "Close",
    },
    hotkey_edit: {
      title: "Enter the desired key combination",
      duplicated: "A duplicated hotkey exists",
      duplicated_action: "'{action}'",
      unbind: "Unbind",
      cancel: "Cancel",
      confirm: "Confirm",
      overwrite: "Overwrite",
    },
    hotkey_restore: {
      title: "Restore the hotkey",
      msg: "The combination of {action} will be restored to default. <br/>Continue?",
      confirm: "Yes",
      close: "Cancel",
    },
    error_no_cell: {
      title: "Text cell not found",
      msg: "please select the text cell you want to export",
      close: "Close",
    },
    export_failed: {
      title: "Failed exporting",
      write_error_msg:
        "An error occurred in writing, please check if there's enough empty space on your disk",
      engine_error_msg:
        "An error occurred in engine, please restart the engine and try again",
      close: "Close",
    },
    save_result: {
      title: "Export results",
      write_error: "Failed(writing error):",
      engine_error: "Failed(engine error):",
      success: "Success:",
      close: "Close",
    },
    change_engine_mode: {
      title: "Engine mode has been modified",
      write_error: "Restart engine to apply the change",
    },
    changing_engine_mode: {
      msg: "Changing engine mode",
    },
    error_gpu_not_found: {
      title: "Compatible GPU not found",
      write_error:
        "Nvidia&trade; GPU is needed to enable GPU mode<br />Enabling GPU mode without a compatible GPU may cause errors, continue?",
      ok: "Continue",
      close: "Cancel",
    },
    warning_changing_sample_rate: {
      title: "Change sample rate for exported audio files",
      write_error:
        "The quality won't be improved by increasing sample rate <br /> Meanwhile, audio with larger sample rate takes more time to generate, <br />continue?",
      ok: "Continue",
      close: "Cancel",
    },
  },
  windows: {
    choose_export_folder: "Choose Export Directory",
    save_audio: "Save Audio",
    save_all_audio: "Save All Audio",
    error_audio_device_not_found: {
      title: "Error",
      msg: "Audio device not found",
    },
    warning_project_overwrite: {
      title: "Warning",
      msg: "This project has been modified \n Discard the change?",
      ok: "Discard",
      close: "Cancel",
    },
    open_project: "Choose Project File",
    save_project: "Save Project File",
  },
  errors: {
    invalid_project_file: "VOICEVOX Project file {filePath} is a invalid file.",
    app_version_mismatch:
      "An invalid appVersion format. The appVersion should be in the format %d.%d.%d",
    app_version_type_error:
      "The appVersion of the project file should be string",
    file_format_error: "Invalid file format",
    any: "An Error Occurred",
  },
  home: {
    starting_engine: "Starting Engine...",
  },
  audio_detail: {
    accent: "Accent",
    pitch: "Pitch",
    length: "Length",
  },
  audio_cell: {
    msg_length_error:
      "Sentence with too many characters may cause errors. Consider splitting it with periods",
  },
  audio_info: {
    speed_scale: "Speed",
    pitch_scale: "Pitch",
    into_scale: "Into.",
    volume_scale: "Volume",
    prefix_silence: "Prefix Sil",
    suffix_silence: "Suffix Sil",
  },
  header_bar: {
    play: "Play",
    stop: "Stop",
    undo: "Undo",
    redo: "Redo",
  },
  help_dialog: {
    root: "Help",
    policy: "Policy",
    library_policy: "Library Policy",
    how_to_use: "How To Use",
    community: "Community",
    license: "License",
    release_note: "Release Note",
  },
  hotkey_dialog: {
    root: "Setting",
    title: "Hotkeys",
    search: "Search",
    restore: "Restore Default",
    action: "Action",
    combination: "Combination",
    read_only: "Read Only",
    blank: "Not Assigned",
  },
  default_style: {
    root: "Setting",
    title: "Default Style",
    choose: "Please choose a style as default",
    listen: "You can listen to some samples",
    tip: "※Can be changed later",
    normal: "Normal",
  },
  menu_bar: {
    file: {
      label: "File",
      new_project: "New Project",
      export_audio: "Export Audio",
      export_one_audio: "Export One Audio",
      read_text_file: "Read Text File",
      save_project: "Save Project",
      save_project_as: "Save Project As",
      open_project: "Open Project",
    },
    engine: {
      label: "Engine",
      restart: "Restart Engine",
    },
    setting: {
      label: "Setting",
      hotkeys: "Hotkeys",
      default_styles: "Default Styles",
      general: "General",
    },
    help: {
      label: "Help",
    },
    pin_tip: "always on top",
  },
  setting_dialog: {
    root: "Setting",
    title: "Option",
    engine: {
      title: "Engine",
      engine_mode: {
        label: "Engine Mode",
        tip: "NVIDIA&trade; GPU is needed to enable GPU mode",
      },
    },
    operation: {
      title: "Operation",
      inherit_parameter: {
        label: "Inherit Parameter",
        tip: "New text cells will inherit parameters in audio info from former cells",
      },
    },
    saving: {
      title: "Save",
      encoding: {
        label: "Text Encoding",
      },
      fix_export_dir: {
        label: "Fix Export Directory",
        tip: "Export audio files to a fixed directory",
        input_label: "Export Directory",
        explore_folder: "Open File Explorer",
      },
      avoid_overwrite: {
        label: "Avoid Overwriting",
        tip: "Append a number to the generated filename to avoid overwriting",
      },
      generate_lab_file: {
        label: "Generate lab file",
        tip: "Generate lab file for lip sync",
      },
      generate_text_file: {
        label: "Generate text file",
        tip: "Generate txt file",
      },
    },
    advanced: {
      title: "Advanced",
      stereo: {
        label: "Stereo Audio",
        tip: "Generate and export audio in stereo",
      },
      device: {
        label: "Playback Device",
        select_label: "Playback Device",
        tip: "Choose playback device",
      },
      sample_rate: {
        label: "Sample Rate",
        tip: "Choose sample rate of exported audio(doesn't improve quality)",
      },
    },
    locale: {
      title: "Localization",
      language: {
        label: "Language",
        tip: "Choose display language",
      },
      fallback: {
        label: "Fallback Language",
        tip: "Choose language for words display language doesn't have translation",
      },
    },
  },
};
