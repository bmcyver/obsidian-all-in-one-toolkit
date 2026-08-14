import {
  Notice,
  Setting,
  MarkdownView,
  TFile,
  ConfirmationModal,
} from 'obsidian';
import { lint } from 'markdownlint/sync';
import { applyFixes, type LintError } from 'markdownlint';
import { BaseManager } from './base';
import {
  MARKDOWNLINT_ALL_RULES,
  DEFAULT_MARKDOWNLINT_RULES,
  getRuleDocUrl,
  type MarkdownlintRuleMetadata,
} from '../constants/markdownlint-rules';
import {
  createToggleSection,
  addErrorContainer,
  showError,
  clearError,
  createFoldableSection,
} from '../utils/ui';
import { MarkdownlintResultModal } from '../ui/markdownlint-result-modal';
import { FolderSuggest } from '../ui/folder-suggest';
import { isValidPath } from '../utils/file';

export class MarkdownlintManager extends BaseManager {
  private managerContainerEl: HTMLElement | null = null;
  private cachedConfig: Record<string, unknown> | null = null;

  protected isEnabled(): boolean {
    return this.plugin.settings.markdownlintEnabled;
  }

  override onSettingsUpdate(): void {
    super.onSettingsUpdate();
    this.invalidateCache();
  }

  public invalidateCache(): void {
    this.cachedConfig = null;
  }

  onload() {
    this.plugin.addCommand({
      id: 'markdownlint-lint-current-note',
      name: '마크다운 서식 검사',
      checkCallback: (checking) => {
        if (!this.isEnabled()) return false;
        if (!checking) {
          this.lintActiveNote();
        }
        return true;
      },
    });

    this.plugin.addCommand({
      id: 'markdownlint-fix-current-note',
      name: '마크다운 서식 교정',
      checkCallback: (checking) => {
        if (!this.isEnabled()) return false;
        if (!checking) {
          this.fixActiveNote(true);
        }
        return true;
      },
    });

    this.plugin.registerDomEvent(
      window,
      'keydown',
      (evt: KeyboardEvent) => {
        if (evt.isComposing) return;
        if (!this.isEnabled() || !this.plugin.settings.autofixOnSave) return;
        const isCtrlOrCmd = evt.ctrlKey || evt.metaKey;
        const isSKey = evt.code === 'KeyS' || evt.key?.toLowerCase() === 's';

        if (isCtrlOrCmd && isSKey) {
          const activeView =
            this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeView) {
            this.fixActiveNote(false);
          }
        }
      },
      true,
    );
  }

  private buildLintConfig(): Record<string, unknown> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const config: Record<string, unknown> = { default: false };
    const userRules =
      this.plugin.settings.markdownlintRules || DEFAULT_MARKDOWNLINT_RULES;

    for (const [ruleId, val] of Object.entries(userRules)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const ruleObj: Record<string, unknown> = { ...val };
        const ruleMeta = MARKDOWNLINT_ALL_RULES.find((r) => r.id === ruleId);
        if (ruleMeta?.subOptions) {
          for (const sub of ruleMeta.subOptions) {
            const rawVal = ruleObj[sub.key];
            if (sub.isList && typeof rawVal === 'string') {
              ruleObj[sub.key] = rawVal
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
            }
          }
        }
        config[ruleId] = ruleObj;
      } else {
        config[ruleId] = val;
      }
    }
    this.cachedConfig = config;
    return config;
  }

  private isFileIgnored(file: TFile | null): boolean {
    if (!file) return false;
    const ignoredFolders =
      this.plugin.settings.markdownlintIgnoredFolders || [];
    if (ignoredFolders.length === 0) return false;

    const filePath = file.path;
    for (const folder of ignoredFolders) {
      const trimmed = folder.trim().replace(/^\/+|\/+$/g, '');
      if (!trimmed) continue;
      if (filePath === trimmed || filePath.startsWith(trimmed + '/')) {
        return true;
      }
    }
    return false;
  }

  private lintActiveNote(): void {
    const activeView =
      this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = activeView?.editor;
    if (!editor) {
      new Notice('활성 에디터가 없습니다.');
      return;
    }

    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (this.isFileIgnored(activeFile)) {
      new Notice('검사 제외 대상 폴더의 노트입니다.');
      return;
    }

    const startTime = performance.now();
    const content = editor.getValue();
    const config = this.buildLintConfig();

    const results = lint({
      strings: { note: content },
      config,
    });

    const issues = results.note || [];
    const durationMs = Math.round(performance.now() - startTime);

    if (issues.length === 0) {
      new Notice(`위반 항목 없음 (${durationMs}ms)`);
    } else {
      new Notice(`${issues.length}개 위반 발견 (${durationMs}ms)`);
      new MarkdownlintResultModal(this.plugin.app, editor, issues, () =>
        this.fixActiveNote(false),
      ).open();
    }
  }

  private fixActiveNote(showNotice = true): void {
    const activeView =
      this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = activeView?.editor;
    if (!editor) {
      if (showNotice) new Notice('활성 에디터가 없습니다.');
      return;
    }

    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (this.isFileIgnored(activeFile)) {
      if (showNotice) new Notice('수정 제외 대상 폴더의 노트입니다.');
      return;
    }

    const startTime = performance.now();
    const content = editor.getValue();
    const config = this.buildLintConfig();

    const results = lint({
      strings: { note: content },
      config,
    });

    const issues: LintError[] = results.note || [];
    const fixableIssues = issues.filter((i) => Boolean(i.fixInfo));

    if (fixableIssues.length === 0) {
      const durationMs = Math.round(performance.now() - startTime);
      if (showNotice) {
        new Notice(`수정 항목 없음 (${durationMs}ms)`);
      }
      return;
    }

    const fixedContent = applyFixes(content, issues);
    if (fixedContent !== content) {
      const cursor = editor.getCursor();
      const scrollInfo = editor.getScrollInfo ? editor.getScrollInfo() : null;

      editor.setValue(fixedContent);

      const maxLine = Math.max(0, editor.lineCount() - 1);
      const targetLine = Math.min(cursor.line, maxLine);
      const lineLength = editor.getLine(targetLine).length;
      const targetCh = Math.min(cursor.ch, lineLength);

      editor.setCursor({ line: targetLine, ch: targetCh });

      if (scrollInfo && typeof editor.scrollTo === 'function') {
        editor.scrollTo(scrollInfo.left, scrollInfo.top);
      }

      const durationMs = Math.round(performance.now() - startTime);
      new Notice(`${fixableIssues.length}개 수정 완료 (${durationMs}ms)`);
    }
  }

  renderSettings(containerEl: HTMLElement): void {
    if (
      !this.managerContainerEl ||
      this.managerContainerEl.parentElement !== containerEl
    ) {
      this.managerContainerEl = containerEl.createDiv();
    } else {
      this.managerContainerEl.empty();
    }
    const targetContainer = this.managerContainerEl;

    const detailEl = createToggleSection(
      targetContainer,
      'Markdownlint',
      this.plugin.settings.markdownlintEnabled,
      async (value) => {
        this.plugin.settings.markdownlintEnabled = value;
        await this.plugin.saveSettings();
      },
    );

    new Setting(detailEl)
      .setName('저장 시 자동 수정')
      .setDesc('저장(Ctrl+S / Cmd+S) 시 규칙 위반을 자동으로 교정합니다.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autofixOnSave)
          .onChange(async (val) => {
            this.plugin.settings.autofixOnSave = val;
            await this.plugin.saveSettings();
          }),
      );

    const ignoredSetting = new Setting(detailEl)
      .setName('제외할 폴더')
      .setDesc(
        '검사 및 자동 수정을 제외할 폴더 경로를 쉼표(,)로 구분하여 입력합니다.',
      );

    const errorEl = addErrorContainer(ignoredSetting);

    ignoredSetting.addText((text) => {
      text.setValue(
        (this.plugin.settings.markdownlintIgnoredFolders || []).join(', '),
      );
      new FolderSuggest(this.plugin.app, text.inputEl);

      text.onChange((val) => {
        void (async () => {
          const paths = val
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);
          for (const p of paths) {
            if (!isValidPath(p)) {
              showError(
                errorEl,
                `경로 '${p}'에 사용할 수 없는 문자가 포함되어 있습니다.`,
              );
              return;
            }
          }
          clearError(errorEl);
          this.plugin.settings.markdownlintIgnoredFolders = paths;
          await this.plugin.saveSettings();
        })();
      });
    });

    const totalRules = MARKDOWNLINT_ALL_RULES.length;
    const { detailsEl: rulesDetails, contentEl: groupContent } =
      createFoldableSection(
        detailEl,
        'Markdownlint 상세 규칙 설정 목록',
        `${totalRules}개 규칙`,
      );

    let isRendered = false;
    rulesDetails.ontoggle = () => {
      if (rulesDetails.open && !isRendered) {
        isRendered = true;
        this.renderGroupRules(groupContent, MARKDOWNLINT_ALL_RULES);
      }
    };

    new Setting(detailEl)
      .setName('규칙 설정 초기화')
      .setDesc('모든 Markdownlint 규칙 및 세부 옵션을 기본값으로 초기화합니다.')
      .addButton((btn) =>
        btn
           .setButtonText('초기화')
           .setDestructive()
           .onClick(() => {
             new ConfirmationModal(this.plugin.app)
               .setTitle('규칙 설정 초기화')
               .setContent(
                 '모든 Markdownlint 규칙 및 세부 옵션을 기본값으로 초기화하시겠습니까?',
               )
               .addButton((b) =>
                 b
                   .setButtonText('초기화')
                   .setDestructive()
                   .onClick(() => {
                     void (async () => {
                       this.plugin.settings.markdownlintRules = JSON.parse(
                         JSON.stringify(DEFAULT_MARKDOWNLINT_RULES),
                       ) as Record<string, boolean | Record<string, unknown>>;
                       this.invalidateCache();
                       await this.plugin.saveSettings();
                       this.renderSettings(containerEl);
                       new Notice('규칙 설정이 기본값으로 초기화되었습니다.');
                     })();
                   }),
               )
               .addButton((b) => b.setButtonText('취소').onClick(() => {}))
               .open();
           }),
      );
  }

  private renderGroupRules(
    containerEl: HTMLElement,
    rules: MarkdownlintRuleMetadata[],
  ): void {
    const fragment = createFragment();
    for (const rule of rules) {
      const ruleContainer = createDiv({
        cls: 'tk-markdownlint-rule-item-container',
      });
      this.renderRuleSetting(ruleContainer, rule);
      fragment.appendChild(ruleContainer);
    }
    containerEl.appendChild(fragment);
  }

  private renderRuleSetting(
    ruleContainer: HTMLElement,
    rule: MarkdownlintRuleMetadata,
  ): void {
    const currentRuleState =
      this.plugin.settings.markdownlintRules[rule.id] ??
      DEFAULT_MARKDOWNLINT_RULES[rule.id] ??
      rule.defaultEnabled;

    const isEnabled = Boolean(currentRuleState);

    const setting = new Setting(ruleContainer);

    setting.nameEl.empty();
    const linkEl = setting.nameEl.createEl('a', {
      cls: 'tk-markdownlint-rule-link',
      href: getRuleDocUrl(rule.id),
    });
    linkEl.target = '_blank';
    linkEl.rel = 'noopener noreferrer';

    linkEl.createEl('strong', {
      cls: 'tk-markdownlint-rule-id',
      text: rule.id,
    });
    linkEl.createSpan({
      cls: 'tk-markdownlint-rule-alias',
      text: ` (${rule.name})`,
    });

    const descText = !rule.defaultEnabled
      ? `${rule.desc} (호환성 이슈로 기본 비활성화됨)`
      : rule.desc;
    setting.setDesc(descText);

    const subOptionContainer = ruleContainer.createDiv({
      cls: 'tk-markdownlint-suboptions-container',
    });
    subOptionContainer.toggleClass('is-hidden', !isEnabled);

    setting.addToggle((toggle) =>
      toggle.setValue(isEnabled).onChange(async (checked) => {
        if (!checked) {
          this.plugin.settings.markdownlintRules[rule.id] = false;
          subOptionContainer.toggleClass('is-hidden', true);
        } else {
          if (rule.subOptions && rule.subOptions.length > 0) {
            const subConfig: Record<string, unknown> = {};
            for (const sub of rule.subOptions) {
              subConfig[sub.key] = sub.default;
            }
            this.plugin.settings.markdownlintRules[rule.id] = subConfig;
          } else {
            this.plugin.settings.markdownlintRules[rule.id] = true;
          }
          subOptionContainer.toggleClass('is-hidden', false);
        }
        this.invalidateCache();
        await this.plugin.saveSettings();
      }),
    );

    if (rule.subOptions && rule.subOptions.length > 0) {
      this.renderSubOptions(subOptionContainer, rule);
    }
  }

  private renderSubOptions(
    containerEl: HTMLElement,
    rule: MarkdownlintRuleMetadata,
  ): void {
    containerEl.empty();
    if (!rule.subOptions) return;

    const getRuleObj = (): Record<string, unknown> => {
      const raw = this.plugin.settings.markdownlintRules[rule.id];
      if (raw && typeof raw === 'object') {
        return raw;
      }
      const defObj: Record<string, unknown> = {};
      const subs = rule.subOptions || [];
      for (const sub of subs) {
        defObj[sub.key] = sub.default;
      }
      return defObj;
    };

    for (const sub of rule.subOptions) {
      const subSetting = new Setting(containerEl);
      subSetting.settingEl.addClass('tk-markdownlint-suboption-item');
      subSetting.setName(sub.name);
      if (sub.desc) {
        subSetting.setDesc(sub.desc);
      }

      const ruleObj = getRuleObj();
      const val = ruleObj[sub.key] ?? sub.default;

      if (sub.type === 'select' && sub.options) {
        subSetting.addDropdown((dropdown) => {
          for (const [optKey, optLabel] of Object.entries(sub.options || {})) {
            dropdown.addOption(optKey, optLabel);
          }
          dropdown.setValue(String(val)).onChange(async (newVal) => {
            const currentObj = getRuleObj();
            currentObj[sub.key] = newVal;
            this.plugin.settings.markdownlintRules[rule.id] = currentObj;
            this.invalidateCache();
            await this.plugin.saveSettings();
          });
        });
      } else if (sub.type === 'number') {
        subSetting.addText((text) =>
          text.setValue(String(val)).onChange(async (newVal) => {
            const num = Number(newVal);
            if (!isNaN(num)) {
              const currentObj = getRuleObj();
              currentObj[sub.key] = num;
              this.plugin.settings.markdownlintRules[rule.id] = currentObj;
              this.invalidateCache();
              await this.plugin.saveSettings();
            }
          }),
        );
      } else if (sub.type === 'boolean') {
        subSetting.addToggle((toggle) =>
          toggle.setValue(Boolean(val)).onChange(async (newVal) => {
            const currentObj = getRuleObj();
            currentObj[sub.key] = newVal;
            this.plugin.settings.markdownlintRules[rule.id] = currentObj;
            this.invalidateCache();
            await this.plugin.saveSettings();
          }),
        );
      } else if (sub.type === 'string') {
        subSetting.addText((text) =>
          text.setValue(String(val)).onChange(async (newVal) => {
            const currentObj = getRuleObj();
            currentObj[sub.key] = newVal;
            this.plugin.settings.markdownlintRules[rule.id] = currentObj;
            this.invalidateCache();
            await this.plugin.saveSettings();
          }),
        );
      }
    }
  }
}
