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
  ConfirmationModal,
} from 'obsidian';
import ejs from '../../ejs/ejs';
import { EJSSecurityModal, EJSSelectModal } from './modals';
import { PromptModal } from '../../shared/ui/prompt-modal';
import { Feature } from '../../shared/types';
import { FolderSuggest, FileSuggest } from '../../shared/ui/folder-suggest';
import { DEFAULT_SETTINGS } from '../../settings';
import { createEJSHighlightExtension } from './highlight';
import { createEJSAutocompleteExtension } from './autocomplete';
import { stripFolderPrefix, isValidPath } from '../../shared/utils/file';
import {
  showError,
  clearError,
  createToggleSection,
  addErrorContainer,
  createFoldableSection,
} from '../../shared/ui/settings-helpers';

const EJS_ALLOWED_HASHES_KEY = 'ejs-allowed-hashes';

interface EJSRenderContext {
  app: App;
  file: TFile;
  title: string;
  moment: typeof moment;
  ejs: {
    prompt: (message: string, defaultValue?: string) => Promise<string>;
    select: (
      message: string,
      items: string[],
      values?: string[],
    ) => Promise<string>;
  };
}

export class EJSFeature extends Feature {
  private compiledRules: Array<{ regex: RegExp; templatePath: string }> = [];
  private securityLock: Promise<void> = Promise.resolve();
  private allowedHashesCache: Record<string, string> | null = null;

  private isEnabled(): boolean {
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
    this.plugin.registerEditorExtension([
      createEJSHighlightExtension(this.plugin),
      createEJSAutocompleteExtension(this.plugin),
    ]);
    this.registerEvent(
      this.plugin.app.vault.on('create', (file) => {
        if (!this.isEnabled()) return;
        void this.handleFileCreate(file);
      }),
    );
  }

  override onSettingsUpdate() {
    if (this.isEnabled()) {
      this.recompileRules();
    }
  }

  private async calculateSHA256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
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
      } catch {
        new Notice(`EJS 규칙 정규식 패턴 오류: ${rule.pattern}`);
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
      const calculatedHash = await this.calculateSHA256(templateContent);

      const isAllowed = await this.checkAndPromptSecurity(
        templatePath,
        calculatedHash,
        templateContent,
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
      } catch {
        await this.plugin.app.vault.adapter.write(file.path, rendered);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      new Notice(`EJS 렌더링 실패: ${errMsg}`);
    }
  }

  private async buildRenderContext(file: TFile): Promise<EJSRenderContext> {
    return {
      app: this.plugin.app,
      file: file,
      title: file.basename,
      moment: moment,
      ejs: {
        prompt: (message: string, defaultValue = ''): Promise<string> => {
          return new Promise((resolve) => {
            new PromptModal(
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
            new EJSSelectModal(
              this.plugin.app,
              message,
              items,
              values || [],
              resolve,
            ).open();
          });
        },
      },
    };
  }

  private promptSecurityApproval(
    templatePath: string,
    templateContent: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      new EJSSecurityModal(
        this.plugin.app,
        templatePath,
        templateContent,
        resolve,
      ).open();
    });
  }

  private async checkAndPromptSecurity(
    templatePath: string,
    calculatedHash: string,
    templateContent: string,
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
        templateContent,
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
      const errMsg = err instanceof Error ? err.message : String(err);
      new Notice(`EJS 보안 승인 처리 실패: ${errMsg}`);
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
    let draggedIndex: number | null = null;

    for (let idx = 0; idx < rules.length; idx++) {
      const rule = rules[idx]!;
      this.renderRuleItem(
        listEl,
        rule,
        idx,
        rulesContainer,
        templatesFolder,
        (fromIdx, toIdx) => {
          const [movedItem] = this.plugin.settings.ejsRules.splice(fromIdx, 1);
          if (movedItem) {
            this.plugin.settings.ejsRules.splice(toIdx, 0, movedItem);
            void (async () => {
              await this.plugin.saveSettings();
              this.recompileRules();
              this.renderRules(rulesContainer);
            })();
          }
        },
        () => draggedIndex,
        (val) => {
          draggedIndex = val;
        },
      );
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
      const calculatedHash = await this.calculateSHA256(content);

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

        showError(errorMsgEl, '보안 승인이 필요합니다.');

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
    onReorder: (fromIdx: number, toIdx: number) => void,
    getDraggedIndex: () => number | null,
    setDraggedIndex: (val: number | null) => void,
  ) {
    const ruleEl = listEl.createDiv('ejs-rule-item');
    ruleEl.draggable = true;

    const mainRowEl = ruleEl.createDiv('ejs-rule-main-row');

    const dragHandleEl = mainRowEl.createDiv('ejs-rule-drag-handle');
    setIcon(dragHandleEl, 'grip-vertical');
    dragHandleEl.setAttribute('aria-label', '드래그하여 순서 변경');
    dragHandleEl.setAttribute('title', '드래그하여 순서 변경');

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
    this.createDeleteButton(mainRowEl, idx, rulesContainer);

    // Drag & Drop Event Listeners
    ruleEl.addEventListener('dragstart', (e: DragEvent) => {
      setDraggedIndex(idx);
      ruleEl.addClass('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      }
    });

    ruleEl.addEventListener('dragend', () => {
      setDraggedIndex(null);
      listEl.querySelectorAll('.ejs-rule-item').forEach((el) => {
        el.removeClass('is-dragging');
        el.removeClass('is-drag-over-top');
        el.removeClass('is-drag-over-bottom');
      });
    });

    ruleEl.addEventListener('dragover', (e: DragEvent) => {
      const currentDragged = getDraggedIndex();
      if (currentDragged === null || currentDragged === idx) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
      const rect = ruleEl.getBoundingClientRect();
      const isTopHalf = e.clientY < rect.top + rect.height / 2;
      ruleEl.toggleClass('is-drag-over-top', isTopHalf);
      ruleEl.toggleClass('is-drag-over-bottom', !isTopHalf);
    });

    ruleEl.addEventListener('dragleave', () => {
      ruleEl.removeClass('is-drag-over-top');
      ruleEl.removeClass('is-drag-over-bottom');
    });

    ruleEl.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      ruleEl.removeClass('is-drag-over-top');
      ruleEl.removeClass('is-drag-over-bottom');
      const currentDragged = getDraggedIndex();
      if (currentDragged === null || currentDragged === idx) return;

      const rect = ruleEl.getBoundingClientRect();
      const isTopHalf = e.clientY < rect.top + rect.height / 2;
      let targetIdx = isTopHalf ? idx : idx + 1;
      if (currentDragged < targetIdx) {
        targetIdx -= 1;
      }
      if (currentDragged !== targetIdx) {
        onReorder(currentDragged, targetIdx);
      }
    });

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

  private createDeleteButton(
    mainRowEl: HTMLElement,
    idx: number,
    rulesContainer: HTMLElement,
  ) {
    const controlsEl = mainRowEl.createDiv('ejs-rule-controls');

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

    let rulesContentEl: HTMLElement | null = null;

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
          if (rulesContentEl) {
            this.renderRules(rulesContentEl);
          }
        })();
      });
    });

    const rulesCount = this.plugin.settings.ejsRules.length;
    const { detailsEl: rulesDetails, contentEl: groupContent } =
      createFoldableSection(
        detailEl,
        'EJS 템플릿 규칙 목록',
        `${rulesCount}개 규칙`,
      );
    rulesContentEl = groupContent;

    let isRendered = false;
    rulesDetails.ontoggle = () => {
      if (rulesDetails.open && !isRendered) {
        isRendered = true;
        this.renderRules(groupContent);
      }
    };

    new Setting(detailEl)
      .setName('템플릿 승인 목록 초기화')
      .setDesc('승인된 EJS 템플릿 해시 목록을 초기화합니다.')
      .addButton((btn) => {
        btn
          .setButtonText('목록 초기화')
          .setDestructive()
          .onClick(() => {
            new ConfirmationModal(this.plugin.app)
              .setTitle('템플릿 승인 목록 초기화')
              .setContent('승인된 EJS 템플릿 해시 목록을 초기화하시겠습니까?')
              .addButton((b) =>
                b
                  .setButtonText('목록 초기화')
                  .setDestructive()
                  .onClick(() => {
                    this.clearAllowedHashes();
                    new Notice('EJS 템플릿 승인 목록이 초기화되었습니다.');
                    if (rulesContentEl && isRendered) {
                      this.renderRules(rulesContentEl);
                    }
                  }),
              )
              .addButton((b) => b.setButtonText('취소').onClick(() => {}))
              .open();
          });
      });
  }
}
