import {
  TAbstractFile,
  TFile,
  Notice,
  moment,
  Setting,
  setIcon,
  App,
  normalizePath,
  TextComponent,
  ExtraButtonComponent,
} from 'obsidian';
import ejs from '../ejs/ejs';
import { EjsSecurityModal } from '../ui/security-modal';
import { EjsPromptModal } from '../ui/prompt-modal';
import { EjsSelectModal } from '../ui/select-modal';
import { BaseManager } from './base';
import { FolderSuggest, FileSuggest } from '../ui/folder-suggest';
import { DEFAULT_SETTINGS } from '../settings';
import { stripFolderPrefix, isValidPath } from '../utils/file';
import {
  showError,
  clearError,
  createToggleSection,
  addErrorContainer,
} from '../utils/ui';
import { calculateSHA256 } from '../utils/crypto';

const EJS_ALLOWED_HASHES_KEY = 'ejs-allowed-hashes';

interface EjsRenderContext {
  app: App;
  file: TFile;
  title: string;
  moment: typeof moment;
  prompt: (message: string, defaultValue?: string) => Promise<string>;
  select: (
    message: string,
    items: string[],
    values?: string[],
  ) => Promise<string>;
}

export class EjsManager extends BaseManager {
  private compiledRules: Array<{ regex: RegExp; templatePath: string }> = [];
  private securityLock: Promise<void> = Promise.resolve();
  private allowedHashesCache: Record<string, string> | null = null;

  protected isEnabled(): boolean {
    return this.plugin.settings.ejsEnabled;
  }

  private getFullTemplatePath(templatePath: string): string {
    if (!templatePath) return '';
    const templatesFolder =
      this.plugin.settings.ejsTemplatesFolder ||
      DEFAULT_SETTINGS.ejsTemplatesFolder;

    const normalizedFolder = normalizePath(templatesFolder);
    const normalizedPath = normalizePath(templatePath);

    if (
      normalizedFolder &&
      normalizedPath
        .toLowerCase()
        .startsWith(normalizedFolder.toLowerCase() + '/')
    ) {
      return normalizedPath;
    }
    return normalizedFolder
      ? normalizePath(`${normalizedFolder}/${normalizedPath}`)
      : normalizedPath;
  }

  onload() {
    this.recompileRules();
    this.registerEventRef(
      this.plugin.app.vault.on('create', (file) => {
        if (!this.isEnabled()) return;
        void this.handleFileCreate(file);
      }),
    );
  }

  onSettingsUpdate() {
    super.onSettingsUpdate();
    if (this.isEnabled()) {
      this.recompileRules();
    }
  }

  private recompileRules() {
    const rules = this.plugin.settings.ejsRules;
    const compiled: Array<{ regex: RegExp; templatePath: string }> = [];

    for (const rule of rules) {
      if (!rule.pattern || !rule.templatePath) continue;
      try {
        compiled.push({
          regex: new RegExp(rule.pattern),
          templatePath: rule.templatePath,
        });
      } catch (err) {
        console.error(`패턴 정규식 오류 "${rule.pattern}":`, err);
      }
    }

    this.compiledRules = compiled;
  }

  private getAllowedHashes(): Record<string, string> {
    if (this.allowedHashesCache !== null) {
      return this.allowedHashesCache;
    }
    const raw = this.plugin.app.loadLocalStorage(
      EJS_ALLOWED_HASHES_KEY,
    ) as unknown;
    if (typeof raw === 'string' && raw.trim() !== '') {
      try {
        this.allowedHashesCache = JSON.parse(raw) as Record<string, string>;
      } catch {
        this.allowedHashesCache = {};
      }
    } else {
      this.allowedHashesCache = {};
    }
    return this.allowedHashesCache;
  }

  private saveAllowedHashes(hashes: Record<string, string>): void {
    this.allowedHashesCache = hashes;
    this.plugin.app.saveLocalStorage(
      EJS_ALLOWED_HASHES_KEY,
      JSON.stringify(hashes),
    );
  }

  private clearAllowedHashes(): void {
    this.allowedHashesCache = {};
    this.plugin.app.saveLocalStorage(
      EJS_ALLOWED_HASHES_KEY,
      JSON.stringify({}),
    );
  }

  private async handleFileCreate(file: TAbstractFile) {
    if (!(file instanceof TFile) || file.extension !== 'md') {
      return;
    }

    let matchedRule = null;
    for (const rule of this.compiledRules) {
      if (rule.regex.test(file.path)) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      return;
    }

    const fileContent = await this.plugin.app.vault.read(file);
    if (fileContent.trim() !== '') {
      return;
    }

    const templatePath = this.getFullTemplatePath(matchedRule.templatePath);
    const templateFile = this.plugin.app.vault.getFileByPath(templatePath);

    if (!templateFile) {
      new Notice(`EJS 템플릿 파일을 찾을 수 없습니다: ${templatePath}`);
      return;
    }

    try {
      const templateContent = await this.plugin.app.vault.read(templateFile);
      const calculatedHash = await calculateSHA256(templateContent);

      const isAllowed = await this.checkAndPromptSecurity(
        templatePath,
        calculatedHash,
      );
      if (!isAllowed) {
        new Notice(
          `보안을 위해 EJS 템플릿 실행이 차단되었습니다: ${templatePath}`,
        );
        return;
      }

      const locals = await this.buildRenderContext(file);

      const rendered = await ejs.render(templateContent, locals, {
        async: true,
      });

      try {
        await this.plugin.app.vault.modify(file, rendered);
      } catch (modifyErr) {
        console.warn('vault.modify failed, trying adapter.write:', modifyErr);
        await this.plugin.app.vault.adapter.write(file.path, rendered);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      new Notice(`EJS 렌더링 실패: ${errMsg}`);
      console.error('EJS 렌더링 중 오류 발생:', err);
    }
  }

  private async buildRenderContext(file: TFile): Promise<EjsRenderContext> {
    return {
      app: this.plugin.app,
      file: file,
      title: file.basename,
      moment: moment,
      prompt: (message: string, defaultValue = ''): Promise<string> => {
        return new Promise((resolve) => {
          new EjsPromptModal(
            this.plugin.app,
            message,
            defaultValue,
            resolve,
          ).open();
        });
      },
      select: (
        message: string,
        items: string[],
        values?: string[],
      ): Promise<string> => {
        return new Promise((resolve) => {
          new EjsSelectModal(
            this.plugin.app,
            message,
            items,
            values || [],
            resolve,
          ).open();
        });
      },
    };
  }

  private promptSecurityApproval(
    templatePath: string,
    hash: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      new EjsSecurityModal(this.plugin.app, templatePath, hash, resolve).open();
    });
  }

  private async checkAndPromptSecurity(
    templatePath: string,
    calculatedHash: string,
  ): Promise<boolean> {
    let releaseLock = () => {};
    const currentLock = this.securityLock;
    this.securityLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    await currentLock;

    try {
      const allowedHashes = this.getAllowedHashes();
      if (allowedHashes[templatePath] === calculatedHash) {
        return true;
      }

      const approved = await this.promptSecurityApproval(
        templatePath,
        calculatedHash,
      );

      if (approved) {
        const latestAllowedHashes = this.getAllowedHashes();
        latestAllowedHashes[templatePath] = calculatedHash;
        this.saveAllowedHashes(latestAllowedHashes);
        new Notice(`EJS 템플릿이 승인되었습니다: ${templatePath}`);
        return true;
      }
      return false;
    } catch (err) {
      console.error('보안 승인 처리 중 오류가 발생했습니다:', err);
      return false;
    } finally {
      releaseLock();
    }
  }

  private validateRegex(pattern: string): boolean {
    if (!pattern) return false;
    try {
      new RegExp(pattern);
      return true;
    } catch {
      return false;
    }
  }

  private renderRules(rulesContainer: HTMLElement): void {
    rulesContainer.empty();

    const listEl = rulesContainer.createDiv('ejs-rules-list');
    const templatesFolder =
      this.plugin.settings.ejsTemplatesFolder ||
      DEFAULT_SETTINGS.ejsTemplatesFolder;

    const rules = this.plugin.settings.ejsRules;
    for (let idx = 0; idx < rules.length; idx++) {
      const rule = rules[idx]!;
      this.renderRuleItem(listEl, rule, idx, rulesContainer, templatesFolder);
    }

    new Setting(rulesContainer)
      .setName('규칙 추가')
      .setDesc('EJS 템플릿을 자동 적용할 정규식 규칙을 추가합니다.')
      .addButton((btn) => {
        btn
          .setButtonText('규칙 추가')
          .setCta()
          .onClick(() => {
            void (async () => {
              this.plugin.settings.ejsRules.push({
                pattern: '',
                templatePath: '',
              });
              await this.plugin.saveSettings();
              this.recompileRules();
              this.renderRules(rulesContainer);
            })();
          });
      });
  }

  private async updateStatusArea(
    rule: { pattern: string; templatePath: string },
    statusAreaEl: HTMLElement,
    errorMsgEl: HTMLElement,
  ) {
    statusAreaEl.empty();
    clearError(errorMsgEl);

    if (!rule.pattern) {
      const badge = statusAreaEl.createDiv('ejs-rule-status-icon missing');
      badge.setAttribute('title', '정규식 패턴 미입력');
      setIcon(badge, 'alert-circle');

      showError(errorMsgEl, '정규식 패턴이 입력되지 않았습니다.');
      return;
    }

    if (!this.validateRegex(rule.pattern)) {
      const badge = statusAreaEl.createDiv('ejs-rule-status-icon missing');
      badge.setAttribute('title', '올바르지 않은 정규식 패턴입니다.');
      setIcon(badge, 'alert-circle');

      showError(errorMsgEl, '올바르지 않은 정규식 패턴입니다.');
      return;
    }

    if (!rule.templatePath) {
      const badge = statusAreaEl.createDiv('ejs-rule-status-icon missing');
      badge.setAttribute('title', '경로 미입력');
      setIcon(badge, 'x');

      showError(errorMsgEl, '템플릿 파일 경로가 입력되지 않았습니다.');
      return;
    }

    const fullPath = this.getFullTemplatePath(rule.templatePath);

    const file = this.plugin.app.vault.getFileByPath(fullPath);
    if (!file) {
      const badge = statusAreaEl.createDiv('ejs-rule-status-icon missing');
      badge.setAttribute('title', '파일 없음');
      setIcon(badge, 'x');

      showError(
        errorMsgEl,
        `지정된 경로에 템플릿 파일이 존재하지 않습니다: ${fullPath}`,
      );
      return;
    }

    try {
      const content = await this.plugin.app.vault.read(file);
      const calculatedHash = await calculateSHA256(content);

      const allowedHashes = this.getAllowedHashes();
      const isAllowed = allowedHashes[fullPath] === calculatedHash;

      if (isAllowed) {
        const badge = statusAreaEl.createDiv('ejs-rule-status-icon approved');
        badge.setAttribute('title', '승인됨');
        setIcon(badge, 'check');
      } else {
        const badge = statusAreaEl.createDiv('ejs-rule-status-icon pending');
        badge.setAttribute('title', '승인 대기');
        setIcon(badge, 'alert-triangle');

        showError(
          errorMsgEl,
          '보안 승인이 필요합니다. 우측 아이콘을 눌러 승인하세요.',
        );

        new ExtraButtonComponent(statusAreaEl)
          .setIcon('check-square')
          .setTooltip('승인')
          .onClick(() => {
            void (async () => {
              const latestAllowedHashes = this.getAllowedHashes();
              latestAllowedHashes[fullPath] = calculatedHash;
              this.saveAllowedHashes(latestAllowedHashes);
              new Notice(`EJS 템플릿이 승인되었습니다: ${rule.templatePath}`);
              await this.updateStatusArea(rule, statusAreaEl, errorMsgEl);
            })();
          });
      }
    } catch (err) {
      const badge = statusAreaEl.createDiv('ejs-rule-status-icon missing');
      badge.setAttribute('title', '해시 오류');
      setIcon(badge, 'x');

      showError(
        errorMsgEl,
        `템플릿 해시 분석 오류: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private renderRuleItem(
    listEl: HTMLElement,
    rule: { pattern: string; templatePath: string },
    idx: number,
    rulesContainer: HTMLElement,
    templatesFolder: string,
  ) {
    const ruleEl = listEl.createDiv('ejs-rule-item');
    const mainRowEl = ruleEl.createDiv('ejs-rule-main-row');
    const statusAreaEl = mainRowEl.createDiv('ejs-rule-status-area');
    const errorMsgEl = ruleEl.createDiv('ejs-rule-error-msg is-hidden');

    const triggerUpdate = () =>
      this.updateStatusArea(rule, statusAreaEl, errorMsgEl);

    this.createPatternInput(mainRowEl, rule, triggerUpdate);
    this.createTemplatePathInput(
      mainRowEl,
      rule,
      templatesFolder,
      triggerUpdate,
    );
    this.createControlButtons(mainRowEl, idx, rulesContainer);

    void triggerUpdate();
  }

  private createPatternInput(
    mainRowEl: HTMLElement,
    rule: { pattern: string; templatePath: string },
    triggerUpdate: () => Promise<void>,
  ) {
    const textComp = new TextComponent(mainRowEl)
      .setPlaceholder('^regex/.*')
      .setValue(rule.pattern);

    const patternInput = textComp.inputEl;
    patternInput.addClass('ejs-rule-pattern-input');

    const checkRegexValidity = () => {
      const val = patternInput.value.trim();
      const isValid = this.validateRegex(val);
      if (isValid) {
        patternInput.removeClass('is-invalid');
        patternInput.removeAttribute('title');
      } else {
        patternInput.addClass('is-invalid');
        patternInput.setAttribute(
          'title',
          val === ''
            ? '정규식 패턴이 입력되지 않았습니다.'
            : '올바르지 않은 정규식 패턴입니다.',
        );
      }
      return isValid;
    };

    textComp.onChange((value) => {
      void (async () => {
        rule.pattern = value.trim();
        await this.plugin.saveSettings();
        this.recompileRules();
        checkRegexValidity();
        await triggerUpdate();
      })();
    });

    checkRegexValidity();
  }

  private createTemplatePathInput(
    mainRowEl: HTMLElement,
    rule: { pattern: string; templatePath: string },
    templatesFolder: string,
    triggerUpdate: () => Promise<void>,
  ) {
    const displayPath = stripFolderPrefix(rule.templatePath, templatesFolder);
    const textComp = new TextComponent(mainRowEl)
      .setPlaceholder('template-name.md')
      .setValue(displayPath);

    const pathInput = textComp.inputEl;
    pathInput.addClass('ejs-rule-path-input');
    new FileSuggest(this.plugin.app, pathInput, templatesFolder);

    textComp.onChange((value) => {
      void (async () => {
        let saveVal = value.trim();
        saveVal = stripFolderPrefix(saveVal, templatesFolder);
        if (rule.templatePath !== saveVal) {
          rule.templatePath = saveVal;
          await this.plugin.saveSettings();
          this.recompileRules();
        }
        await triggerUpdate();
      })();
    });
  }

  private createControlButtons(
    mainRowEl: HTMLElement,
    idx: number,
    rulesContainer: HTMLElement,
  ) {
    const controlsEl = mainRowEl.createDiv('ejs-rule-controls');

    if (idx > 0) {
      new ExtraButtonComponent(controlsEl)
        .setIcon('chevron-up')
        .setTooltip('위로 이동')
        .onClick(() => {
          void (async () => {
            const current = this.plugin.settings.ejsRules[idx];
            const target = this.plugin.settings.ejsRules[idx - 1];
            if (current && target) {
              this.plugin.settings.ejsRules[idx - 1] = current;
              this.plugin.settings.ejsRules[idx] = target;
              await this.plugin.saveSettings();
              this.recompileRules();
              this.renderRules(rulesContainer);
            }
          })();
        });
    }

    if (idx < this.plugin.settings.ejsRules.length - 1) {
      new ExtraButtonComponent(controlsEl)
        .setIcon('chevron-down')
        .setTooltip('아래로 이동')
        .onClick(() => {
          void (async () => {
            const current = this.plugin.settings.ejsRules[idx];
            const target = this.plugin.settings.ejsRules[idx + 1];
            if (current && target) {
              this.plugin.settings.ejsRules[idx + 1] = current;
              this.plugin.settings.ejsRules[idx] = target;
              await this.plugin.saveSettings();
              this.recompileRules();
              this.renderRules(rulesContainer);
            }
          })();
        });
    }

    new ExtraButtonComponent(controlsEl)
      .setIcon('x')
      .setTooltip('규칙 삭제')
      .onClick(() => {
        void (async () => {
          this.plugin.settings.ejsRules.splice(idx, 1);
          await this.plugin.saveSettings();
          this.recompileRules();
          this.renderRules(rulesContainer);
        })();
      });
  }

  renderSettings(containerEl: HTMLElement) {
    const detailEl = createToggleSection(
      containerEl,
      'EJS 템플릿',
      this.plugin.settings.ejsEnabled,
      async (value) => {
        this.plugin.settings.ejsEnabled = value;
        await this.plugin.saveSettings();
      },
    );

    const folderSetting = new Setting(detailEl)
      .setName('EJS 템플릿 폴더')
      .setDesc('EJS 템플릿 파일이 저장된 폴더 경로입니다.');

    const errorEl = addErrorContainer(folderSetting);

    folderSetting.addText((text) => {
      text.setValue(this.plugin.settings.ejsTemplatesFolder || '');
      new FolderSuggest(this.plugin.app, text.inputEl);

      text.onChange((val) => {
        void (async () => {
          const trimmed = val.trim();
          if (!isValidPath(trimmed)) {
            showError(
              errorEl,
              '경로에 사용할 수 없는 문자가 포함되어 있습니다.',
            );
            return;
          }
          clearError(errorEl);
          this.plugin.settings.ejsTemplatesFolder = trimmed;
          await this.plugin.saveSettings();
          this.renderRules(rulesContainer);
        })();
      });
    });

    const rulesContainer = detailEl.createDiv('ejs-rules-container');
    rulesContainer.addClass('ejs-rules-wrapper');

    const headerSetting = new Setting(rulesContainer)
      .setName('EJS 템플릿 규칙')
      .setHeading();
    headerSetting.settingEl.addClass('ejs-rules-header');

    rulesContainer.createEl('p', {
      text: '생성되는 파일 경로와 일치하는 EJS 템플릿을 자동으로 적용합니다. 위쪽에 위치한 규칙이 우선 적용됩니다.',
      cls: 'setting-item-description',
    });

    this.renderRules(rulesContainer);

    new Setting(detailEl)
      .setName('템플릿 승인 목록 초기화')
      .setDesc('승인된 EJS 템플릿 해시 목록을 초기화합니다.')
      .addButton((btn) => {
        btn
          .setButtonText('목록 초기화')
          .setDestructive()
          .setCta()
          .onClick(() => {
            this.clearAllowedHashes();
            new Notice('EJS 템플릿 승인 목록이 초기화되었습니다.');
            this.renderRules(rulesContainer);
          });
      });
  }
}
