import {
  TAbstractFile,
  TFile,
  Notice,
  moment,
  Setting,
  setIcon,
  App,
  normalizePath,
} from 'obsidian';
import ejs from '../ejs/ejs';
import { EjsSecurityModal } from '../ui/security-modal';
import { EjsPromptModal } from '../ui/prompt-modal';
import { EjsSelectModal } from '../ui/select-modal';
import { BaseManager } from './base';
import { FolderSuggest, FileSuggest } from '../ui/folder-suggest';
import { DEFAULT_SETTINGS } from '../settings';
import { stripFolderPrefix, isValidPath } from '../utils/file';
import { showError, clearError, addErrorContainer } from '../utils/ui';

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
  private compiledRules: Array<{ regex: RegExp; templatePath: string } | null> =
    [];
  private securityQueue: Promise<void> = Promise.resolve();
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
    this.plugin.registerEvent(
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
    this.compiledRules = this.plugin.settings.ejsRules.map((rule) => {
      if (!rule.pattern || !rule.templatePath) return null;
      try {
        return {
          regex: new RegExp(rule.pattern),
          templatePath: rule.templatePath,
        };
      } catch (err) {
        console.error(`패턴 정규식 오류 "${rule.pattern}":`, err);
        return null;
      }
    });
  }

  private getAllowedHashes(): Record<string, string> {
    if (this.allowedHashesCache !== null) {
      return this.allowedHashesCache;
    }
    const raw = this.plugin.app.loadLocalStorage(
      EJS_ALLOWED_HASHES_KEY,
    ) as unknown;
    this.allowedHashesCache =
      typeof raw === 'string'
        ? (JSON.parse(raw) as Record<string, string>)
        : {};
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
    this.plugin.app.saveLocalStorage(EJS_ALLOWED_HASHES_KEY, '');
  }

  private async handleFileCreate(file: TAbstractFile) {
    if (!(file instanceof TFile) || file.extension !== 'md') {
      return;
    }

    let matchedRule = null;
    for (const rule of this.compiledRules) {
      if (!rule) continue;
      if (rule.regex.test(file.path)) {
        matchedRule = rule;
        break; // First match wins
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
      // 1. Read template content and compute SHA-256 hash
      const templateContent = await this.plugin.app.vault.read(templateFile);
      const calculatedHash = await this.calculateSHA256(templateContent);

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

      // 2. Define rendering context (locals)
      const locals = await this.buildRenderContext(file);

      // 3. Render template asynchronously
      const rendered = await ejs.render(templateContent, locals, {
        async: true,
      });

      // 4. Overwrite generated file content
      try {
        await this.plugin.app.vault.modify(file, rendered);
      } catch (modifyErr) {
        console.warn('vault.modify failed, trying adapter.write:', modifyErr);
        await this.plugin.app.vault.adapter.write(file.path, rendered);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      new Notice(`EJS 렌더링 오류: ${errMsg}`);
      console.error('EJS 렌더링 중 오류 발생:', err);
    }
  }

  /**
   * Modular context builder for EJS template injection, allowing clean expansion.
   */
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

  private async calculateSHA256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private promptSecurityApproval(
    templatePath: string,
    hash: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      new EjsSecurityModal(this.plugin.app, templatePath, hash, resolve).open();
    });
  }

  private checkAndPromptSecurity(
    templatePath: string,
    calculatedHash: string,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.securityQueue = this.securityQueue
        .then(async () => {
          const allowedHashes = this.getAllowedHashes();

          const isAllowed = allowedHashes[templatePath] === calculatedHash;
          if (isAllowed) {
            resolve(true);
            return;
          }

          const approved = await this.promptSecurityApproval(
            templatePath,
            calculatedHash,
          );

          if (!approved) {
            resolve(false);
            return;
          }

          const latestAllowedHashes = this.getAllowedHashes();
          latestAllowedHashes[templatePath] = calculatedHash;
          this.saveAllowedHashes(latestAllowedHashes);
          new Notice(`EJS 템플릿 해시가 승인되었습니다: ${templatePath}`);
          resolve(true);
        })
        .catch((err) => {
          console.error('보안 승인 처리 중 오류가 발생했습니다:', err);
          resolve(false);
        });
    });
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

  private renderRules(rulesContainer: HTMLElement) {
    rulesContainer.empty();

    const listEl = rulesContainer.createDiv('ejs-rules-list');
    const templatesFolder =
      this.plugin.settings.ejsTemplatesFolder ||
      DEFAULT_SETTINGS.ejsTemplatesFolder;

    this.plugin.settings.ejsRules.forEach((rule, idx) => {
      this.renderRuleItem(listEl, rule, idx, rulesContainer, templatesFolder);
    });

    // Add Rule Button Container at the bottom (Setting Box style)
    new Setting(rulesContainer)
      .setName('새 파일 정규식 추가')
      .setDesc(
        'EJS 템플릿을 자동으로 매핑할 새로운 파일 정규식 규칙을 추가합니다.',
      )
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

    // 1. Regex validation check
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

    // 2. Path validation check
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
      const calculatedHash = await this.calculateSHA256(content);

      const allowedHashes = this.getAllowedHashes();
      const isAllowed = allowedHashes[fullPath] === calculatedHash;

      if (isAllowed) {
        const badge = statusAreaEl.createDiv('ejs-rule-status-icon approved');
        badge.setAttribute('title', '실행 승인됨');
        setIcon(badge, 'check');
      } else {
        const badge = statusAreaEl.createDiv('ejs-rule-status-icon pending');
        badge.setAttribute('title', '승인 대기중');
        setIcon(badge, 'alert-triangle');

        showError(
          errorMsgEl,
          '보안 승인이 필요합니다. 우측의 체크 아이콘을 눌러 승인해 주세요.',
        );

        // Quick Approve Button
        const approveBtn = statusAreaEl.createEl('button', {
          cls: 'ejs-rule-btn btn-approve-quick',
          title: '즉시 승인',
        });
        setIcon(approveBtn, 'check-square');
        approveBtn.addEventListener('click', () => {
          void (async () => {
            const latestAllowedHashes = this.getAllowedHashes();
            latestAllowedHashes[fullPath] = calculatedHash;
            this.saveAllowedHashes(latestAllowedHashes);
            new Notice(
              `EJS 템플릿이 즉시 승인되었습니다: ${rule.templatePath}`,
            );
            await this.updateStatusArea(rule, statusAreaEl, errorMsgEl);
          })();
        });
      }
    } catch (err) {
      const badge = statusAreaEl.createDiv('ejs-rule-status-icon missing');
      badge.setAttribute('title', '해시 에러');
      setIcon(badge, 'x');

      showError(
        errorMsgEl,
        `템플릿 무결성 해시 분석 중 오류가 발생했습니다: ${err instanceof Error ? err.message : String(err)}`,
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

    // Create upper main horizontal row
    const mainRowEl = ruleEl.createDiv('ejs-rule-main-row');

    // 1. Status Area
    const statusAreaEl = mainRowEl.createDiv('ejs-rule-status-area');

    // 5. Error Message Element (Placed below mainRowEl inside padding)
    const errorMsgEl = ruleEl.createDiv('ejs-rule-error-msg is-hidden');

    const triggerUpdate = () =>
      this.updateStatusArea(rule, statusAreaEl, errorMsgEl);

    // 2. Pattern Input
    this.createPatternInput(mainRowEl, rule, triggerUpdate);

    // 3. Template Path Wrapper
    this.createTemplatePathInput(
      mainRowEl,
      rule,
      templatesFolder,
      triggerUpdate,
    );

    // 4. Control Buttons
    this.createControlButtons(mainRowEl, idx, rulesContainer);

    // Trigger initial status check (asynchronous)
    void triggerUpdate();
  }

  private createPatternInput(
    mainRowEl: HTMLElement,
    rule: { pattern: string; templatePath: string },
    triggerUpdate: () => Promise<void>,
  ) {
    const patternInput = mainRowEl.createEl('input', {
      type: 'text',
      placeholder: '^regex/.*',
      value: rule.pattern,
      cls: 'ejs-rule-pattern-input',
    });

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

    patternInput.addEventListener('input', () => {
      void (async () => {
        rule.pattern = patternInput.value.trim();
        await this.plugin.saveSettings();
        this.recompileRules();
        checkRegexValidity();
        await triggerUpdate();
      })();
    });

    // Initial validation
    checkRegexValidity();
  }

  private createTemplatePathInput(
    mainRowEl: HTMLElement,
    rule: { pattern: string; templatePath: string },
    templatesFolder: string,
    triggerUpdate: () => Promise<void>,
  ) {
    const pathWrapper = mainRowEl.createDiv('ejs-template-path-wrapper');

    const searchIconEl = pathWrapper.createDiv('ejs-template-path-icon');
    setIcon(searchIconEl, 'search');

    const displayPath = stripFolderPrefix(rule.templatePath, templatesFolder);
    const pathInput = pathWrapper.createEl('input', {
      type: 'text',
      placeholder: 'template-name.md',
      value: displayPath,
    });

    new FileSuggest(this.plugin.app, pathInput, templatesFolder);

    const updateTemplatePath = () => {
      void (async () => {
        let saveVal = pathInput.value.trim();
        saveVal = stripFolderPrefix(saveVal, templatesFolder);
        rule.templatePath = saveVal;
        await this.plugin.saveSettings();
        this.recompileRules();
        await triggerUpdate();
      })();
    };

    pathInput.addEventListener('input', updateTemplatePath);
    pathInput.addEventListener('change', updateTemplatePath);
    pathInput.addEventListener('blur', updateTemplatePath);
  }

  private createControlButtons(
    mainRowEl: HTMLElement,
    idx: number,
    rulesContainer: HTMLElement,
  ) {
    const controlsEl = mainRowEl.createDiv('ejs-rule-controls');

    // Move Up
    if (idx > 0) {
      const upBtn = controlsEl.createEl('button', {
        cls: 'ejs-rule-btn',
        title: '위로 이동',
      });
      setIcon(upBtn, 'chevron-up');
      upBtn.addEventListener('click', () => {
        void (async () => {
          const temp = this.plugin.settings.ejsRules[idx - 1]!;
          this.plugin.settings.ejsRules[idx - 1] =
            this.plugin.settings.ejsRules[idx]!;
          this.plugin.settings.ejsRules[idx] = temp;
          await this.plugin.saveSettings();
          this.recompileRules();
          this.renderRules(rulesContainer);
        })();
      });
    }

    // Move Down
    if (idx < this.plugin.settings.ejsRules.length - 1) {
      const downBtn = controlsEl.createEl('button', {
        cls: 'ejs-rule-btn',
        title: '아래로 이동',
      });
      setIcon(downBtn, 'chevron-down');
      downBtn.addEventListener('click', () => {
        void (async () => {
          const temp = this.plugin.settings.ejsRules[idx + 1]!;
          this.plugin.settings.ejsRules[idx + 1] =
            this.plugin.settings.ejsRules[idx]!;
          this.plugin.settings.ejsRules[idx] = temp;
          await this.plugin.saveSettings();
          this.recompileRules();
          this.renderRules(rulesContainer);
        })();
      });
    }

    // Delete
    const deleteBtn = controlsEl.createEl('button', {
      cls: 'ejs-rule-btn delete-btn',
      title: '규칙 삭제',
    });
    setIcon(deleteBtn, 'x');
    deleteBtn.addEventListener('click', () => {
      void (async () => {
        this.plugin.settings.ejsRules.splice(idx, 1);
        await this.plugin.saveSettings();
        this.recompileRules();
        this.renderRules(rulesContainer);
      })();
    });
  }

  renderSettings(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName('EJS 템플릿')
      .setHeading()
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.ejsEnabled).onChange((value) => {
          void (async () => {
            this.plugin.settings.ejsEnabled = value;
            await this.plugin.saveSettings();
            detailEl.style.display = value ? '' : 'none';
          })();
        });
      });

    const detailEl = containerEl.createDiv();
    detailEl.style.display = this.plugin.settings.ejsEnabled ? '' : 'none';

    // 1. EJS 템플릿 폴더 설정을 맨 위로 배치
    const folderSetting = new Setting(detailEl)
      .setName('EJS 템플릿 폴더')
      .setDesc('EJS 템플릿 파일이 저장된 폴더 경로입니다.');

    const folderErrorEl = addErrorContainer(folderSetting);

    folderSetting.addText((text) => {
      new FolderSuggest(this.plugin.app, text.inputEl);
      text.setValue(this.plugin.settings.ejsTemplatesFolder || '');
      text.onChange((value) => {
        void (async () => {
          const trimmed = value.trim();
          if (!isValidPath(trimmed)) {
            showError(
              folderErrorEl,
              '경로에 사용할 수 없는 문자가 포함되어 있습니다.',
            );
            return;
          }
          clearError(folderErrorEl);
          this.plugin.settings.ejsTemplatesFolder = trimmed;
          await this.plugin.saveSettings();
          // Re-render rules lists if folder changes
          this.renderRules(rulesContainer);
        })();
      });
    });

    // 2. regex 규칙 목록 생성 및 배치
    const rulesContainer = detailEl.createDiv('ejs-rules-container');
    rulesContainer.addClass('ejs-rules-wrapper');

    const headerSetting = new Setting(rulesContainer)
      .setName('EJS 템플릿 규칙')
      .setHeading();
    headerSetting.settingEl.addClass('ejs-rules-header');

    rulesContainer.createEl('p', {
      text: '새로 생성되는 파일의 경로 패턴을 기반으로 자동 적용할 EJS 템플릿 파일을 정규식(Regex)으로 매핑합니다. 규칙은 위에서부터 순서대로 적용되며, 가장 먼저 일치하는 규칙이 우선 적용됩니다.',
      cls: 'setting-item-description',
    });

    this.renderRules(rulesContainer);

    // 3. 승인된 템플릿 해시 초기화 설정 배치
    new Setting(detailEl)
      .setName('승인된 템플릿 해시 초기화')
      .setDesc(
        '로컬 스토리지에 저장되어 실행이 승인된 모든 EJS 템플릿의 SHA-256 해시 목록을 초기화합니다.',
      )
      .addButton((button) => {
        button.setButtonText('해시 초기화').onClick(() => {
          this.clearAllowedHashes();
          new Notice('모든 EJS 템플릿 해시가 성공적으로 초기화되었습니다.');
          // Re-render status badges
          this.renderRules(rulesContainer);
        });
        button.buttonEl.addClass('mod-warning');
      });
  }
}
