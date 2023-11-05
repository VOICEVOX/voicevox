<template>
  <q-dialog
    v-model="settingDialogOpenedComputed"
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-background">
      <q-page-container class="root">
        <q-header class="q-pa-sm">
          <q-toolbar>
            <q-toolbar-title class="text-display"
              >設定 / オプション</q-toolbar-title
            >
            <q-space />
            <!-- close button -->
            <q-btn
              round
              flat
              icon="close"
              color="display"
              aria-label="設定を閉じる"
              @click="settingDialogOpenedComputed = false"
            />
          </q-toolbar>
        </q-header>
        <q-page ref="scroller" class="scroller">
          <div class="q-pa-md row items-start q-gutter-md">
            <!-- Engine Mode Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <h5 class="text-h5">エンジン</h5>
                <template v-if="engineIds.length > 1">
                  <q-space />
                  <q-select
                    v-model="selectedEngineId"
                    borderless
                    dense
                    name="engine"
                    :options="engineIds"
                    :option-label="renderEngineNameLabel"
                  />
                </template>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>エンジンモード</div>
                <div
                  aria-label=" GPU モードの利用には GPU が必要です。Linux は
                      NVIDIA&trade; 製 GPU のみ対応しています。また、エンジンが対応していない場合、切り替えられません。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      GPU モードの利用には GPU が必要です。Linux は
                      NVIDIA&trade; 製 GPU のみ対応しています。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-btn-toggle
                  v-model="engineUseGpu"
                  padding="xs md"
                  unelevated
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="engineUseGpuOptions"
                  :disable="!gpuSwitchEnabled(selectedEngineId)"
                >
                  <q-tooltip
                    anchor="center start"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                    :target="!gpuSwitchEnabled(selectedEngineId)"
                  >
                    {{
                      engineInfos[selectedEngineId].name
                    }}はCPU版のためGPUモードを利用できません。
                  </q-tooltip>
                </q-btn-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>音声のサンプリングレート</div>
                <div
                  aria-label="再生と保存時の音声のサンプリングレートを変更できます（サンプリングレートを上げても音声の品質は上がりません）。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      再生・保存時の音声のサンプリングレートを変更できます（サンプリングレートを上げても音声の品質は上がりません）。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-select
                  v-model="outputSamplingRate"
                  borderless
                  name="samplingRate"
                  :options="samplingRateOptions"
                  :option-label="renderSamplingRateLabel"
                >
                </q-select>
              </q-card-actions>
            </q-card>
            <!-- Preservation Setting -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <h5 class="text-h5">操作</h5>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>パラメータの引き継ぎ</div>
                <div
                  aria-label="ONの場合、テキスト欄追加の際に、現在の話速等のパラメータが引き継がれます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、テキスト欄追加の際に、現在の話速等のパラメータが引き継がれます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="inheritAudioInfoMode"
                  @update:model-value="changeinheritAudioInfo($event)"
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>再生位置を追従</div>
                <div
                  aria-label="音声再生中の、下部パネルの自動スクロールのモードを選べます。"
                >
                  <span
                    v-for="(obj, key) in activePointScrollModeOptions"
                    :key="key"
                    class="visually-hidden"
                    >{{ `「${obj.label}」モードの場合、${obj.desc}` }}</span
                  >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      音声再生中の、下部パネルの自動スクロールのモードを選べます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <div class="scroll-mode-toggle">
                  <q-radio
                    v-for="(obj, key) in activePointScrollModeOptions"
                    :key="key"
                    v-model="activePointScrollMode"
                    :val="key"
                    :label="obj.label"
                    size="0"
                    :class="[
                      'q-px-md',
                      'q-py-sm',
                      key !== activePointScrollMode && 'scroll-mode-button',
                      key === activePointScrollMode &&
                        'scroll-mode-button-selected',
                    ]"
                    :style="[
                      key === 'CONTINUOUSLY' && 'border-radius: 3px 0 0 3px',
                      key === 'OFF' && 'border-radius: 0 3px 3px 0',
                    ]"
                  >
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      {{ obj.desc }}
                    </q-tooltip>
                  </q-radio>
                </div>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>テキスト分割の区切り</div>
                <div
                  aria-label="テキスト貼り付けの際のテキストの分割箇所を選べます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      テキスト貼り付けの際のテキストの分割箇所を選べます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  :model-value="splitTextWhenPaste"
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="[
                    {
                      label: '句点と改行',
                      value: 'PERIOD_AND_NEW_LINE',
                      slot: 'splitTextPeriodAndNewLine',
                    },
                    {
                      label: '改行',
                      value: 'NEW_LINE',
                      slot: 'splitTextNewLine',
                    },
                    { label: 'オフ', value: 'OFF', slot: 'splitTextOFF' },
                  ]"
                  @update:model-value="changeSplitTextWhenPaste($event)"
                >
                  <template #splitTextPeriodAndNewLine>
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      句点と改行を基にテキストを分割します。
                    </q-tooltip>
                  </template>
                  <template #splitTextNewLine>
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      改行のみを基にテキストを分割します。
                    </q-tooltip>
                  </template>
                  <template #splitTextOFF>
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      分割を行いません。
                    </q-tooltip>
                  </template>
                </q-btn-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>非表示にしたヒントを全て再表示</div>
                <div
                  aria-label="過去に非表示にしたヒントを全て再表示できます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      過去に非表示にしたヒントを全て再表示できます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <!-- ボタンクリックのフィードバックのためのチェックマーク -->
                <q-icon
                  v-if="isDefaultConfirmedTips && hasResetConfirmedTips"
                  name="check"
                  size="sm"
                  color="primary"
                  style="margin-right: 8px"
                >
                </q-icon>
                <q-btn
                  label="再表示する"
                  unelevated
                  color="background"
                  text-color="display"
                  class="text-no-wrap q-mr-sm"
                  :disable="isDefaultConfirmedTips"
                  @click="
                    () => {
                      store.dispatch('RESET_CONFIRMED_TIPS');
                      hasResetConfirmedTips = true;
                    }
                  "
                >
                </q-btn>
              </q-card-actions>
            </q-card>
            <!-- Saving Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <h5 class="text-h5">保存</h5>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>書き出し先を固定</div>
                <div
                  aria-label="ONの場合、書き出す際のフォルダをあらかじめ指定できます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、書き出す際のフォルダをあらかじめ指定できます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-input
                  v-if="savingSetting.fixedExportEnabled"
                  dense
                  maxheight="10px"
                  label="書き出し先のフォルダ"
                  hide-bottom-space
                  readonly
                  :model-value="savingSetting.fixedExportDir"
                  :input-style="{
                    width: `${savingSetting.fixedExportDir.length / 2 + 1}em`,
                    minWidth: '150px',
                    maxWidth: '450px',
                  }"
                  @update:model-value="
                    (event) => {
                      if (event == null) throw 'event is null';
                      handleSavingSettingChange('fixedExportDir', event);
                    }
                  "
                >
                  <template #append>
                    <q-btn
                      square
                      dense
                      flat
                      color="primary"
                      icon="folder_open"
                      @click="openFileExplore"
                    >
                      <q-tooltip :delay="500" anchor="bottom left">
                        フォルダ選択
                      </q-tooltip>
                    </q-btn>
                  </template>
                </q-input>
                <q-toggle
                  :model-value="savingSetting.fixedExportEnabled"
                  @update:model-value="
                    handleSavingSettingChange('fixedExportEnabled', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>

              <file-name-pattern-dialog
                v-model:open-dialog="showsFilePatternEditDialog"
              />

              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>書き出しファイル名パターン</div>
                <div
                  aria-label="書き出す際のファイル名のパターンをカスタマイズできます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      書き出す際のファイル名のパターンをカスタマイズできます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <div class="q-px-sm text-ellipsis">
                  {{ savingSetting.fileNamePattern }}
                </div>
                <q-btn
                  label="編集する"
                  unelevated
                  color="background"
                  text-color="display"
                  class="text-no-wrap q-mr-sm"
                  @click="showsFilePatternEditDialog = true"
                />
              </q-card-actions>

              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>上書き防止</div>
                <div
                  aria-label="ONの場合、書き出す際に同名ファイルが既にあった場合に、かわりに連番で保存され、上書きされません。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、書き出す際に同名ファイルが既にあった場合に、かわりに連番で保存され、上書きされません。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.avoidOverwrite"
                  @update:model-value="
                    handleSavingSettingChange('avoidOverwrite', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>文字コード</div>
                <div
                  aria-label="テキストファイルを書き出す際の文字コードを選べます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      テキストファイルを書き出す際の文字コードを選べます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  :model-value="savingSetting.fileEncoding"
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="[
                    { label: 'UTF-8', value: 'UTF-8' },
                    { label: 'Shift_JIS', value: 'Shift_JIS' },
                  ]"
                  @update:model-value="
                    handleSavingSettingChange('fileEncoding', $event)
                  "
                />
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>txtファイルを書き出し</div>
                <div
                  aria-label="ONの場合、テキストがtxtファイルとして音声書き出し時に追加で書き出されます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、テキストがtxtファイルとして音声書き出し時に追加で書き出されます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.exportText"
                  color="primary"
                  @update:model-value="
                    handleSavingSettingChange('exportText', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>labファイルを書き出し</div>
                <div
                  aria-label="ONの場合、リップシンク用のlabファイルが音声書き出し時に追加で書き出されます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、リップシンク用のlabファイルが音声書き出し時に追加で書き出されます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.exportLab"
                  @update:model-value="
                    handleSavingSettingChange('exportLab', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
            </q-card>
            <!-- Theme Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <h5 class="text-h5">外観</h5>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>テーマ</div>
                <div aria-label="エディタの色を選べます。">
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      エディタの色を選べます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-btn-toggle
                  v-model="currentThemeNameComputed"
                  unelevated
                  padding="xs md"
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="availableThemeNameComputed"
                />
              </q-card-actions>

              <q-card-actions class="q-px-md q-py-sm bg-surface">
                <div>フォント</div>
                <div aria-label="エディタのフォントを選べます。">
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      エディタのフォントを選べます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-btn-toggle
                  padding="xs md"
                  unelevated
                  :model-value="editorFont"
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="[
                    { label: 'デフォルト', value: 'default' },
                    { label: 'OS標準', value: 'os' },
                  ]"
                  @update:model-value="changeEditorFont($event)"
                />
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>行番号の表示</div>
                <div
                  aria-label="ONの場合、テキスト欄の左側に行番号が表示されます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、テキスト欄の左側に行番号が表示されます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="showTextLineNumber"
                  @update:model-value="changeShowTextLineNumber($event)"
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>テキスト追加ボタンの表示</div>
                <div
                  aria-label="OFFの場合、右下にテキスト追加ボタンが表示されません。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      OFFの場合、右下にテキスト追加ボタンが表示されません。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="showAddAudioItemButton"
                  @update:model-value="changeShowAddAudioItemButton($event)"
                >
                </q-toggle>
              </q-card-actions>
            </q-card>

            <!-- Experimental Card -->
            <q-card flat class="setting-card">
              <q-card-actions>
                <h5 class="text-h5">高度な設定</h5>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>音声をステレオ化</div>
                <div
                  aria-label="ONの場合、音声データがモノラルからステレオに変換されてから再生・保存が行われます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、音声データがモノラルからステレオに変換されてから再生・保存が行われます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="savingSetting.outputStereo"
                  @update:model-value="
                    handleSavingSettingChange('outputStereo', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions
                class="q-px-md q-py-none bg-surface"
                :class="{ disabled: !canSetAudioOutputDevice }"
              >
                <div>再生デバイス</div>
                <div aria-label="音声の再生デバイスを変更できます。">
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      音声の再生デバイスを変更できます。
                      <template v-if="!canSetAudioOutputDevice">
                        この機能はお使いの環境でサポートされていないため、使用できません。
                      </template>
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-select
                  v-model="currentAudioOutputDeviceComputed"
                  :disable="!canSetAudioOutputDevice"
                  dense
                  label="再生デバイス"
                  :options="availableAudioOutputDevices"
                  class="col-7"
                >
                </q-select>
              </q-card-actions>
            </q-card>
            <q-card flat class="setting-card">
              <q-card-actions>
                <div class="text-h5">実験的機能</div>
              </q-card-actions>
              <!-- 今後実験的機能を追加する場合はここに追加 -->
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>プリセット機能</div>
                <div
                  aria-label="プリセット機能を有効にします。あらかじめ登録しておいた話速などのパラメータを呼び出せるようになります。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      プリセット機能を有効にします。あらかじめ登録しておいた話速などのパラメータを呼び出せるようになります。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="experimentalSetting.enablePreset"
                  @update:model-value="changeEnablePreset"
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>スタイル変更時にデフォルトプリセットを適用</div>
                <div
                  aria-label="ONの場合、キャラやスタイルの変更時にデフォルトプリセットが自動的に適用されます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、キャラやスタイルの変更時にデフォルトプリセットが自動的に適用されます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="
                    experimentalSetting.shouldApplyDefaultPresetOnVoiceChanged
                  "
                  :disable="!experimentalSetting.enablePreset"
                  @update:model-value="
                    changeExperimentalSetting(
                      'shouldApplyDefaultPresetOnVoiceChanged',
                      $event
                    )
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>疑問文を自動調整</div>
                <div
                  aria-label="ONの場合、疑問文の語尾の音高が自動的に上げられます。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、疑問文の語尾の音高が自動的に上げられます。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="experimentalSetting.enableInterrogativeUpspeak"
                  @update:model-value="
                    changeExperimentalSetting(
                      'enableInterrogativeUpspeak',
                      $event
                    )
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>モーフィング機能</div>
                <div
                  aria-label="モーフィング機能を有効にします。2つのスタイルの中間を選べるようになります。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      モーフィング機能を有効にします。2つのスタイルの中間を選べるようになります。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="experimentalSetting.enableMorphing"
                  @update:model-value="
                    changeExperimentalSetting('enableMorphing', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>マルチエンジン機能</div>
                <div
                  aria-label="マルチエンジン機能を有効にします。複数のVOICEVOX準拠エンジンが利用可能になります。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      マルチエンジン機能を有効にします。複数のVOICEVOX準拠エンジンが利用可能になります。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="experimentalSetting.enableMultiEngine"
                  @update:model-value="
                    changeExperimentalSetting('enableMultiEngine', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions
                v-if="!isProduction"
                class="q-px-md q-py-none bg-surface"
              >
                <div>複数選択</div>
                <div aria-label="複数のテキスト欄を選択できるようにします。">
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      複数のテキスト欄を選択できるようにします。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="experimentalSetting.enableMultiSelect"
                  @update:model-value="
                    changeExperimentalSetting('enableMultiSelect', $event)
                  "
                >
                </q-toggle>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>調整結果の保持</div>
                <div
                  aria-label="テキスト変更時、同じ読みのアクセント区間内の調整結果を保持します。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                      >ONの場合、テキスト変更時、同じ読みのアクセント区間内の調整結果を保持します。</q-tooltip
                    >
                  </q-icon>
                </div>
                <q-space />
                <q-toggle
                  :model-value="
                    experimentalSetting.shouldKeepTuningOnTextChange
                  "
                  @update:model-value="
                    changeExperimentalSetting(
                      'shouldKeepTuningOnTextChange',
                      $event
                    )
                  "
                >
                </q-toggle>
              </q-card-actions>
            </q-card>
            <q-card flat class="setting-card">
              <q-card-actions>
                <h5 class="text-h5">データ収集</h5>
              </q-card-actions>
              <q-card-actions class="q-px-md q-py-none bg-surface">
                <div>ソフトウェア利用状況のデータ収集を許可</div>
                <div
                  aria-label="ONの場合、各UIの利用率などのデータが送信され、VOICEVOXの改善に役立てられます。テキストデータや音声データは送信されません。"
                >
                  <q-icon name="help_outline" size="sm" class="help-hover-icon">
                    <q-tooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、各UIの利用率などのデータが送信され、VOICEVOXの改善に役立てられます。テキストデータ・音声データは送信されません。
                    </q-tooltip>
                  </q-icon>
                </div>
                <q-space />
                <q-toggle v-model="acceptRetrieveTelemetryComputed" />
              </q-card-actions>
            </q-card>
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import FileNamePatternDialog from "./FileNamePatternDialog.vue";
import { useStore } from "@/store";
import {
  isProduction,
  SavingSetting,
  EngineSetting,
  ExperimentalSetting,
  ActivePointScrollMode,
  SplitTextWhenPasteType,
  EditorFontType,
  EngineId,
} from "@/type/preload";

type SamplingRateOption = EngineSetting["outputSamplingRate"];

const props =
  defineProps<{
    modelValue: boolean;
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", val: boolean): void;
  }>();

const store = useStore();

const settingDialogOpenedComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const engineUseGpu = computed({
  get: () => {
    return store.state.engineSettings[selectedEngineId.value].useGpu;
  },
  set: (mode: boolean) => {
    changeUseGpu(mode);
  },
});
const engineIds = computed(() => store.state.engineIds);
const engineInfos = computed(() => store.state.engineInfos);
const inheritAudioInfoMode = computed(() => store.state.inheritAudioInfo);
const activePointScrollMode = computed({
  get: () => store.state.activePointScrollMode,
  set: (activePointScrollMode: ActivePointScrollMode) => {
    store.dispatch("SET_ACTIVE_POINT_SCROLL_MODE", {
      activePointScrollMode,
    });
  },
});
const activePointScrollModeOptions: Record<
  ActivePointScrollMode,
  {
    label: string;
    desc: string;
  }
> = {
  CONTINUOUSLY: {
    label: "連続",
    desc: "現在の再生位置を真ん中に表示します。",
  },
  PAGE: {
    label: "ページめくり",
    desc: "現在の再生位置が表示範囲外にある場合にスクロールします。",
  },
  OFF: {
    label: "オフ",
    desc: "自動でスクロールしません。",
  },
};
const experimentalSetting = computed(() => store.state.experimentalSetting);

// 非表示にしたヒントの再表示
const hasResetConfirmedTips = ref(false);
const isDefaultConfirmedTips = computed(() => {
  const confirmedTips = store.state.confirmedTips;
  // すべて false (= 初期値) かどうか確認
  return Object.values(confirmedTips).every((v) => !v);
});

// 外観
const currentThemeNameComputed = computed({
  get: () => store.state.themeSetting.currentTheme,
  set: (currentTheme: string) => {
    store.dispatch("SET_THEME_SETTING", { currentTheme: currentTheme });
  },
});

const availableThemeNameComputed = computed(() => {
  return [...store.state.themeSetting.availableThemes]
    .sort((a, b) => a.order - b.order)
    .map((theme) => {
      return { label: theme.displayName, value: theme.name };
    });
});

const editorFont = computed(() => store.state.editorFont);
const changeEditorFont = (editorFont: EditorFontType) => {
  store.dispatch("SET_EDITOR_FONT", { editorFont });
};

const showTextLineNumber = computed(() => store.state.showTextLineNumber);
const changeShowTextLineNumber = (showTextLineNumber: boolean) => {
  store.dispatch("SET_SHOW_TEXT_LINE_NUMBER", {
    showTextLineNumber,
  });
};

// エディタの＋ボタン表示設定
const showAddAudioItemButton = computed(
  () => store.state.showAddAudioItemButton
);
const changeShowAddAudioItemButton = async (
  showAddAudioItemButton: boolean
) => {
  store.dispatch("SET_SHOW_ADD_AUDIO_ITEM_BUTTON", {
    showAddAudioItemButton,
  });

  // 設定をオフにする場合はヒントを表示
  if (!showAddAudioItemButton) {
    const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
      title: "エディタの＋ボタンを非表示にする",
      message: "テキスト欄は Shift + Enter で追加できます",
      actionName: "非表示",
    });
    if (result === "CANCEL") {
      // キャンセルしたら設定を元に戻す
      store.dispatch("SET_SHOW_ADD_AUDIO_ITEM_BUTTON", {
        showAddAudioItemButton: true,
      });
    }
  }
};

const canSetAudioOutputDevice = computed(() => {
  return !!HTMLAudioElement.prototype.setSinkId;
});
const currentAudioOutputDeviceComputed = computed<
  | {
      key: string;
      label: string;
    }
  | undefined
>({
  get: () => {
    // 再生デバイスが見つからなかったらデフォルト値に戻す
    const device = availableAudioOutputDevices.value?.find(
      (device) => device.key === store.state.savingSetting.audioOutputDevice
    );
    if (device) {
      return device;
    } else if (store.state.savingSetting.audioOutputDevice !== "default") {
      handleSavingSettingChange("audioOutputDevice", "default");
    }
    return undefined;
  },
  set: (device) => {
    if (device) {
      handleSavingSettingChange("audioOutputDevice", device.key);
    }
  },
});

const availableAudioOutputDevices = ref<{ key: string; label: string }[]>();
const updateAudioOutputDevices = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  availableAudioOutputDevices.value = devices
    .filter((device) => device.kind === "audiooutput")
    .map((device) => {
      return { label: device.label, key: device.deviceId };
    });
};
if (navigator.mediaDevices) {
  navigator.mediaDevices.addEventListener(
    "devicechange",
    updateAudioOutputDevices
  );
  updateAudioOutputDevices();
} else {
  store.dispatch("LOG_WARN", "navigator.mediaDevices is not available.");
}

const acceptRetrieveTelemetryComputed = computed({
  get: () => store.state.acceptRetrieveTelemetry == "Accepted",
  set: (acceptRetrieveTelemetry: boolean) => {
    store.dispatch("SET_ACCEPT_RETRIEVE_TELEMETRY", {
      acceptRetrieveTelemetry: acceptRetrieveTelemetry ? "Accepted" : "Refused",
    });

    if (acceptRetrieveTelemetry) {
      return;
    }

    store.dispatch("SHOW_ALERT_DIALOG", {
      title: "ソフトウェア利用状況のデータ収集の無効化",
      message:
        "ソフトウェア利用状況のデータ収集を完全に無効にするには、VOICEVOXを再起動する必要があります",
      ok: "OK",
    });
  },
});

const changeUseGpu = async (useGpu: boolean) => {
  store.dispatch("SHOW_LOADING_SCREEN", {
    message: "起動モードを変更中です",
  });

  await store.dispatch("CHANGE_USE_GPU", {
    useGpu,
    engineId: selectedEngineId.value,
  });

  store.dispatch("HIDE_ALL_LOADING_SCREEN");
};

const changeinheritAudioInfo = async (inheritAudioInfo: boolean) => {
  if (store.state.inheritAudioInfo === inheritAudioInfo) return;
  store.dispatch("SET_INHERIT_AUDIOINFO", { inheritAudioInfo });
};

const changeEnablePreset = (value: boolean) => {
  if (value) {
    // プリセット機能をONにしたときは「デフォルトプリセットを自動で適用」もONにする
    changeExperimentalSetting("enablePreset", true);
    changeExperimentalSetting("shouldApplyDefaultPresetOnVoiceChanged", true);
  } else {
    changeExperimentalSetting("enablePreset", false);
    changeExperimentalSetting("shouldApplyDefaultPresetOnVoiceChanged", false);
  }
};

const changeExperimentalSetting = async (
  key: keyof ExperimentalSetting,
  data: boolean
) => {
  store.dispatch("SET_EXPERIMENTAL_SETTING", {
    experimentalSetting: { ...experimentalSetting.value, [key]: data },
  });
};

const savingSetting = computed(() => store.state.savingSetting);

const engineUseGpuOptions = [
  { label: "CPU", value: false },
  { label: "GPU", value: true },
];

const gpuSwitchEnabled = (engineId: EngineId) => {
  // CPU版でもGPUモードからCPUモードに変更できるようにする
  return store.getters.ENGINE_CAN_USE_GPU(engineId) || engineUseGpu.value;
};

const samplingRateOptions: SamplingRateOption[] = [
  "engineDefault",
  24000,
  44100,
  48000,
  88200,
  96000,
];
const renderSamplingRateLabel = (value: SamplingRateOption): string => {
  if (value === "engineDefault") {
    return "デフォルト";
  } else {
    return `${value / 1000} kHz`;
  }
};

const handleSavingSettingChange = (
  key: keyof SavingSetting,
  data: string | boolean | number
) => {
  store.dispatch("SET_SAVING_SETTING", {
    data: { ...savingSetting.value, [key]: data },
  });
};

const outputSamplingRate = computed({
  get: () => {
    return store.state.engineSettings[selectedEngineId.value]
      .outputSamplingRate;
  },
  set: async (outputSamplingRate: SamplingRateOption) => {
    if (outputSamplingRate !== "engineDefault") {
      const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
        title: "出力サンプリングレートを変更します",
        message:
          "出力サンプリングレートを変更しても、音質は変化しません。また、音声の生成処理に若干時間がかかる場合があります。<br />変更しますか？",
        html: true,
        actionName: "変更する",
        cancel: "変更しない",
      });
      if (result !== "OK") {
        return;
      }
    }

    store.dispatch("SET_ENGINE_SETTING", {
      engineId: selectedEngineId.value,
      engineSetting: {
        ...store.state.engineSettings[selectedEngineId.value],
        outputSamplingRate,
      },
    });
  },
});

const openFileExplore = async () => {
  const path = await window.electron.showOpenDirectoryDialog({
    title: "書き出し先のフォルダを選択",
  });
  if (path) {
    store.dispatch("SET_SAVING_SETTING", {
      data: { ...savingSetting.value, fixedExportDir: path },
    });
  }
};

const splitTextWhenPaste = computed(() => store.state.splitTextWhenPaste);
const changeSplitTextWhenPaste = (
  splitTextWhenPaste: SplitTextWhenPasteType
) => {
  store.dispatch("SET_SPLIT_TEXT_WHEN_PASTE", { splitTextWhenPaste });
};

const showsFilePatternEditDialog = ref(false);

const selectedEngineIdRaw = ref<EngineId | undefined>(undefined);
const selectedEngineId = computed({
  get: () => {
    return selectedEngineIdRaw.value || engineIds.value[0];
  },
  set: (engineId: EngineId) => {
    selectedEngineIdRaw.value = engineId;
  },
});
const renderEngineNameLabel = (engineId: EngineId) => {
  return engineInfos.value[engineId].name;
};
</script>

<style scoped lang="scss">
@use '@/styles/visually-hidden' as visually-hidden;
@use "@/styles/colors" as colors;

.visually-hidden {
  @include visually-hidden.visually-hidden;
}

.text-h5 {
  margin: 0;
}

.setting-dialog {
  .q-field__control {
    color: colors.$primary;
  }
}

.help-hover-icon {
  margin-left: 6px;
  color: colors.$display;
  opacity: 0.5;
}

.hotkey-table {
  width: 100%;
}

.setting-card {
  @extend .hotkey-table;
  min-width: 475px;
  background: colors.$background;
}

.scroll-mode-toggle {
  background: colors.$background;
  border-radius: 3px;
}

.scroll-mode-button {
  background: colors.$background;
  color: colors.$display;
  transition: 0.5s;
}

.scroll-mode-button-selected {
  background: colors.$primary;
  color: colors.$display-on-primary;
}

.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scroll-mode-button:hover {
  background: rgba(colors.$primary-rgb, 0.2);
}

.setting-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  .scroll {
    left: unset !important;
    right: unset !important;
    width: unset !important;
    max-height: unset;
  }
}

.root {
  .scroller {
    overflow-y: scroll;
    > div {
      position: absolute;
      left: 0;
      right: 0;
    }
  }
}
</style>
