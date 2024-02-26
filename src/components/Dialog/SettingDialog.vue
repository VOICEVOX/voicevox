<template>
  <QDialog
    v-model="settingDialogOpenedComputed"
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer class="root">
        <QHeader class="q-pa-sm">
          <QToolbar>
            <QToolbarTitle class="text-display"
              >設定 / オプション</QToolbarTitle
            >
            <QSpace />
            <!-- close button -->
            <QBtn
              round
              flat
              icon="close"
              color="display"
              aria-label="設定を閉じる"
              @click="settingDialogOpenedComputed = false"
            />
          </QToolbar>
        </QHeader>
        <QPage ref="scroller" class="scroller">
          <div class="q-pa-md row items-start q-gutter-md">
            <!-- Engine Mode Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">エンジン</h5>
                <template v-if="engineIds.length > 1">
                  <QSpace />
                  <QSelect
                    v-model="selectedEngineId"
                    borderless
                    dense
                    name="engine"
                    :options="engineIds"
                    :option-label="renderEngineNameLabel"
                  />
                </template>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>エンジンモード</div>
                <div
                  aria-label=" GPU モードの利用には GPU が必要です。Linux は
                      NVIDIA&trade; 製 GPU のみ対応しています。また、エンジンが対応していない場合、切り替えられません。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      GPU モードの利用には GPU が必要です。Linux は
                      NVIDIA&trade; 製 GPU のみ対応しています。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QBtnToggle
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
                  <QTooltip
                    :delay="500"
                    :target="!gpuSwitchEnabled(selectedEngineId)"
                  >
                    {{
                      engineInfos[selectedEngineId].name
                    }}はCPU版のためGPUモードを利用できません。
                  </QTooltip>
                </QBtnToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>音声のサンプリングレート</div>
                <div
                  aria-label="再生と保存時の音声のサンプリングレートを変更できます（サンプリングレートを上げても音声の品質は上がりません）。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      再生・保存時の音声のサンプリングレートを変更できます（サンプリングレートを上げても音声の品質は上がりません）。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QSelect
                  v-model="outputSamplingRate"
                  borderless
                  dense
                  name="samplingRate"
                  :options="samplingRateOptions"
                  :option-label="renderSamplingRateLabel"
                >
                </QSelect>
              </QCardActions>
            </QCard>
            <!-- Preservation Setting -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">操作</h5>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>プリセット機能</div>
                <div
                  aria-label="プリセット機能を有効にします。パラメータを登録したり適用したりできます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      プリセット機能を有効にします。パラメータを登録したり適用したりできます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="experimentalSetting.enablePreset"
                  @update:model-value="changeEnablePreset"
                >
                </QToggle>
              </QCardActions>
              <QSlideTransition>
                <!-- q-slide-transitionはheightだけをアニメーションするのでdivで囲う -->
                <div v-show="experimentalSetting.enablePreset">
                  <QCardActions
                    class="q-px-md bg-surface in-slide-transition-workaround"
                  >
                    <div>スタイル変更時にデフォルトプリセットを適用</div>
                    <div
                      aria-label="ONの場合、キャラやスタイルの変更時にデフォルトプリセットが自動的に適用されます。"
                    >
                      <QIcon
                        name="help_outline"
                        size="sm"
                        class="help-hover-icon"
                      >
                        <QTooltip
                          :delay="500"
                          anchor="center right"
                          self="center left"
                          transition-show="jump-right"
                          transition-hide="jump-left"
                        >
                          ONの場合、キャラやスタイルの変更時にデフォルトプリセットが自動的に適用されます。
                        </QTooltip>
                      </QIcon>
                    </div>
                    <QSpace />
                    <QToggle
                      :model-value="
                        experimentalSetting.shouldApplyDefaultPresetOnVoiceChanged
                      "
                      @update:model-value="
                        changeExperimentalSetting(
                          'shouldApplyDefaultPresetOnVoiceChanged',
                          $event
                        )
                      "
                    >
                    </QToggle>
                  </QCardActions>
                </div>
              </QSlideTransition>
              <QCardActions class="q-px-md bg-surface">
                <div>パラメータの引き継ぎ</div>
                <div
                  aria-label="ONの場合、テキスト欄追加の際に、現在の話速等のパラメータが引き継がれます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、テキスト欄追加の際に、現在の話速等のパラメータが引き継がれます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="inheritAudioInfoMode"
                  @update:model-value="changeinheritAudioInfo($event)"
                >
                </QToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>再生位置を追従</div>
                <div
                  aria-label="音声再生中の、詳細調整欄の自動スクロールのモードを選べます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      音声再生中の、詳細調整欄の自動スクロールのモードを選べます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QBtnToggle
                  v-model="activePointScrollMode"
                  padding="xs md"
                  unelevated
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="[
                    {
                      label: '連続',
                      value: 'CONTINUOUSLY',
                      slot: 'CONTINUOUSLY',
                    },
                    {
                      label: 'ページめくり',
                      value: 'PAGE',
                      slot: 'PAGE',
                    },
                    {
                      label: 'オフ',
                      value: 'OFF',
                      slot: 'OFF',
                    },
                  ]"
                >
                  <template #CONTINUOUSLY>
                    <QTooltip :delay="500">
                      現在の再生位置を真ん中に表示します。
                    </QTooltip>
                  </template>
                  <template #PAGE>
                    <QTooltip :delay="500">
                      現在の再生位置が表示範囲外にある場合にスクロールします。
                    </QTooltip>
                  </template>
                  <template #OFF>
                    <QTooltip :delay="500">
                      自動でスクロールしません。
                    </QTooltip>
                  </template>
                </QBtnToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>テキスト自動分割</div>
                <div
                  aria-label="テキスト貼り付けの際のテキストの分割箇所を選べます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      テキスト貼り付けの際のテキストの分割箇所を選べます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <!-- FIXME: ツールチップの内容をaria-labelに付ける -->
                <QBtnToggle
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
                    <QTooltip :delay="500">
                      句点と改行を基にテキストを分割します。
                    </QTooltip>
                  </template>
                  <template #splitTextNewLine>
                    <QTooltip :delay="500">
                      改行のみを基にテキストを分割します。
                    </QTooltip>
                  </template>
                  <template #splitTextOFF>
                    <QTooltip :delay="500"> 分割を行いません。 </QTooltip>
                  </template>
                </QBtnToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>メモ機能</div>
                <div
                  aria-label="ONの場合、テキストを [] で囲むことで、テキスト中にメモを書けます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、テキストを []
                      で囲むことで、テキスト中にメモを書けます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="enableMemoNotation"
                  @update:model-value="changeEnableMemoNotation($event)"
                >
                </QToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>ルビ機能</div>
                <div
                  aria-label="ONの場合、テキストに {ルビ対象|よみかた} と書くことで、テキストの読み方を変えられます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、テキストに {ルビ対象|よみかた}
                      と書くことで、テキストの読み方を変えられます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="enableRubyNotation"
                  @update:model-value="changeEnableRubyNotation($event)"
                >
                </QToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>非表示にしたヒントを全て再表示</div>
                <div
                  aria-label="過去に非表示にしたヒントを全て再表示できます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      過去に非表示にしたヒントを全て再表示できます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <!-- ボタンクリックのフィードバックのためのチェックマーク -->
                <QIcon
                  v-if="isDefaultConfirmedTips && hasResetConfirmedTips"
                  name="check"
                  size="sm"
                  color="primary"
                  style="margin-right: 8px"
                >
                </QIcon>
                <QBtn
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
                </QBtn>
              </QCardActions>
            </QCard>
            <!-- Saving Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">保存</h5>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>書き出し先を固定</div>
                <div
                  aria-label="ONの場合、書き出す際のフォルダをあらかじめ指定できます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、書き出す際のフォルダをあらかじめ指定できます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QInput
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
                    <QBtn
                      square
                      dense
                      flat
                      color="primary"
                      icon="folder_open"
                      @click="openFileExplore"
                    >
                      <QTooltip :delay="500" anchor="bottom left">
                        フォルダ選択
                      </QTooltip>
                    </QBtn>
                  </template>
                </QInput>
                <QToggle
                  :model-value="savingSetting.fixedExportEnabled"
                  @update:model-value="
                    handleSavingSettingChange('fixedExportEnabled', $event)
                  "
                >
                </QToggle>
              </QCardActions>

              <FileNamePatternDialog
                v-model:open-dialog="showsFilePatternEditDialog"
              />

              <QCardActions class="q-px-md bg-surface">
                <div>書き出しファイル名パターン</div>
                <div
                  aria-label="書き出す際のファイル名のパターンをカスタマイズできます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      書き出す際のファイル名のパターンをカスタマイズできます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <div class="q-px-sm text-ellipsis">
                  {{ savingSetting.fileNamePattern }}
                </div>
                <QBtn
                  label="編集する"
                  unelevated
                  color="background"
                  text-color="display"
                  class="text-no-wrap q-mr-sm"
                  @click="showsFilePatternEditDialog = true"
                />
              </QCardActions>

              <QCardActions class="q-px-md bg-surface">
                <div>上書き防止</div>
                <div
                  aria-label="ONの場合、書き出す際に同名ファイルが既にあったとき、ファイル名に連番を付けて別名で保存されます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、書き出す際に同名ファイルが既にあったとき、ファイル名に連番を付けて別名で保存されます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="savingSetting.avoidOverwrite"
                  @update:model-value="
                    handleSavingSettingChange('avoidOverwrite', $event)
                  "
                >
                </QToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>文字コード</div>
                <div
                  aria-label="テキストファイルを書き出す際の文字コードを選べます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      テキストファイルを書き出す際の文字コードを選べます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QBtnToggle
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
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>txtファイルを書き出し</div>
                <div
                  aria-label="ONの場合、音声書き出しの際にテキストがtxtファイルとして書き出されます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、音声書き出しの際にテキストがtxtファイルとして書き出されます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="savingSetting.exportText"
                  color="primary"
                  @update:model-value="
                    handleSavingSettingChange('exportText', $event)
                  "
                >
                </QToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>labファイルを書き出し</div>
                <div
                  aria-label="ONの場合、音声書き出しの際にリップシンク用のlabファイルが書き出されます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、音声書き出しの際にリップシンク用のlabファイルが書き出されます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="savingSetting.exportLab"
                  @update:model-value="
                    handleSavingSettingChange('exportLab', $event)
                  "
                >
                </QToggle>
              </QCardActions>
            </QCard>
            <!-- Theme Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">外観</h5>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>テーマ</div>
                <div aria-label="エディタの色を選べます。">
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      エディタの色を選べます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QBtnToggle
                  v-model="currentThemeNameComputed"
                  unelevated
                  padding="xs md"
                  color="background"
                  text-color="display"
                  toggle-color="primary"
                  toggle-text-color="display-on-primary"
                  :options="availableThemeNameComputed"
                />
              </QCardActions>

              <QCardActions class="q-px-md bg-surface">
                <div>フォント</div>
                <div aria-label="エディタのフォントを選べます。">
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      エディタのフォントを選べます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QBtnToggle
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
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>行番号の表示</div>
                <div
                  aria-label="ONの場合、テキスト欄の左側に行番号が表示されます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、テキスト欄の左側に行番号が表示されます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="showTextLineNumber"
                  @update:model-value="changeShowTextLineNumber($event)"
                >
                </QToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>テキスト追加ボタンの表示</div>
                <div
                  aria-label="OFFの場合、右下にテキスト追加ボタンが表示されません。（テキスト欄は Shift + Enter で追加できます）"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      OFFの場合、右下にテキスト追加ボタンが表示されません。（テキスト欄は
                      Shift + Enter で追加できます）
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="showAddAudioItemButton"
                  @update:model-value="changeShowAddAudioItemButton($event)"
                >
                </QToggle>
              </QCardActions>
            </QCard>

            <!-- Advanced Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">高度な設定</h5>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>マルチエンジン機能</div>
                <div>
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      複数のVOICEVOX準拠エンジンを利用可能にする
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="enableMultiEngine"
                  @update:model-value="setEnableMultiEngine($event)"
                >
                </QToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>音声をステレオ化</div>
                <div
                  aria-label="ONの場合、音声データがモノラルからステレオに変換されてから再生・保存が行われます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、音声データがモノラルからステレオに変換されてから再生・保存が行われます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="savingSetting.outputStereo"
                  @update:model-value="
                    handleSavingSettingChange('outputStereo', $event)
                  "
                >
                </QToggle>
              </QCardActions>
              <QCardActions
                class="q-px-md bg-surface"
                :class="{ disabled: !canSetAudioOutputDevice }"
              >
                <div>再生デバイス</div>
                <div aria-label="音声の再生デバイスを変更できます。">
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
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
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QSelect
                  v-model="currentAudioOutputDeviceComputed"
                  :disable="!canSetAudioOutputDevice"
                  dense
                  name="audioOutputDevice"
                  :options="availableAudioOutputDevices"
                  class="col-7"
                >
                </QSelect>
              </QCardActions>
            </QCard>

            <!-- Experimental Card -->
            <QCard flat class="setting-card">
              <QCardActions>
                <div class="text-h5">実験的機能</div>
              </QCardActions>
              <!-- 今後実験的機能を追加する場合はここに追加 -->
              <QCardActions class="q-px-md bg-surface">
                <div>疑問文を自動調整</div>
                <div
                  aria-label="ONの場合、疑問文の語尾の音高が自動的に上げられます。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、疑問文の語尾の音高が自動的に上げられます。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="experimentalSetting.enableInterrogativeUpspeak"
                  @update:model-value="
                    changeExperimentalSetting(
                      'enableInterrogativeUpspeak',
                      $event
                    )
                  "
                >
                </QToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>モーフィング機能</div>
                <div
                  aria-label="モーフィング機能を有効にします。2つの音声混ぜられるようになります。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      モーフィング機能を有効にします。2つの音声混ぜられるようになります。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="experimentalSetting.enableMorphing"
                  @update:model-value="
                    changeExperimentalSetting('enableMorphing', $event)
                  "
                >
                </QToggle>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>複数選択</div>
                <div aria-label="複数のテキスト欄を選択できるようにします。">
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      複数のテキスト欄を選択できるようにします。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="experimentalSetting.enableMultiSelect"
                  @update:model-value="
                    changeExperimentalSetting('enableMultiSelect', $event)
                  "
                >
                </QToggle>
              </QCardActions>
              <QCardActions v-if="!isProduction" class="q-px-md bg-surface">
                <div>[開発時のみ機能] 調整結果の保持</div>
                <div
                  aria-label="テキスト変更時、同じ読みのアクセント区間内の調整結果を保持します。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                      >ONの場合、テキスト変更時、同じ読みのアクセント区間内の調整結果を保持します。</QTooltip
                    >
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
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
                </QToggle>
              </QCardActions>
              <QCardActions v-if="!isProduction" class="q-px-md bg-surface">
                <div>[開発時のみ機能] ピッチの表示</div>
                <div aria-label="ソングエディターで、ピッチを表示します。">
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                      >ONの場合、ソングエディターで、レンダリング後にピッチが表示されます。</QTooltip
                    >
                  </QIcon>
                </div>
                <QSpace />
                <QToggle
                  :model-value="experimentalSetting.showPitchInSongEditor"
                  @update:model-value="
                    changeExperimentalSetting('showPitchInSongEditor', $event)
                  "
                >
                </QToggle>
              </QCardActions>
            </QCard>
            <QCard flat class="setting-card">
              <QCardActions>
                <h5 class="text-h5">データ収集</h5>
              </QCardActions>
              <QCardActions class="q-px-md bg-surface">
                <div>ソフトウェア利用状況のデータ収集を許可</div>
                <div
                  aria-label="ONの場合、各UIの利用率などのデータが送信され、VOICEVOXの改善に役立てられます。テキストデータや音声データは送信されません。"
                >
                  <QIcon name="help_outline" size="sm" class="help-hover-icon">
                    <QTooltip
                      :delay="500"
                      anchor="center right"
                      self="center left"
                      transition-show="jump-right"
                      transition-hide="jump-left"
                    >
                      ONの場合、各UIの利用率などのデータが送信され、VOICEVOXの改善に役立てられます。テキストデータ・音声データは送信されません。
                    </QTooltip>
                  </QIcon>
                </div>
                <QSpace />
                <QToggle v-model="acceptRetrieveTelemetryComputed" />
              </QCardActions>
            </QCard>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import FileNamePatternDialog from "./FileNamePatternDialog.vue";
import { useStore } from "@/store";
import {
  isProduction,
  SavingSetting,
  EngineSettingType,
  ExperimentalSettingType,
  ActivePointScrollMode,
  RootMiscSettingType,
  EngineId,
} from "@/type/preload";

type SamplingRateOption = EngineSettingType["outputSamplingRate"];

// ルート直下にある雑多な設定値を簡単に扱えるようにする
const useRootMiscSetting = <T extends keyof RootMiscSettingType>(key: T) => {
  const state = computed(() => store.state[key]);
  const setter = (value: RootMiscSettingType[T]) => {
    // Vuexの型処理でUnionが解かれてしまうのを迂回している
    // FIXME: このワークアラウンドをなくす
    store.dispatch("SET_ROOT_MISC_SETTING", { key: key as never, value });
  };
  return [state, setter] as const;
};

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

const [editorFont, changeEditorFont] = useRootMiscSetting("editorFont");

const [enableMultiEngine, setEnableMultiEngine] =
  useRootMiscSetting("enableMultiEngine");

const [showTextLineNumber, changeShowTextLineNumber] =
  useRootMiscSetting("showTextLineNumber");

const [showAddAudioItemButton, changeShowAddAudioItemButton] =
  useRootMiscSetting("showAddAudioItemButton");

const [enableMemoNotation, changeEnableMemoNotation] =
  useRootMiscSetting("enableMemoNotation");

const [enableRubyNotation, changeEnableRubyNotation] =
  useRootMiscSetting("enableRubyNotation");

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
    // FIXME: watchなどにしてgetter内で操作しないようにする
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
  key: keyof ExperimentalSettingType,
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
  const path = await window.backend.showSaveDirectoryDialog({
    title: "書き出し先のフォルダを選択",
  });
  if (path) {
    store.dispatch("SET_SAVING_SETTING", {
      data: { ...savingSetting.value, fixedExportDir: path },
    });
  }
};

const [splitTextWhenPaste, changeSplitTextWhenPaste] =
  useRootMiscSetting("splitTextWhenPaste");

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

.text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
