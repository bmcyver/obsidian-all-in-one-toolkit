import { TAbstractFile, TFile, Notice, moment, Setting } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';
import ejs from '../ejs/ejs';
import { EjsSecurityModal } from '../ui/security-modal';
import { EjsPromptModal } from '../ui/prompt-modal';
import { EjsSelectModal } from '../ui/select-modal';
import { BaseManager } from './base';
import { FolderSuggest, FileSuggest } from '../ui/folder-suggest';

export class EjsManager implements BaseManager {
  plugin: AllInOneToolkitPlugin;

  constructor(plugin: AllInOneToolkitPlugin) {
    this.plugin = plugin;
  }

  onload() {
    // Register event will automatically clean up when the plugin is unloaded
    this.plugin.registerEvent(
      this.plugin.app.vault.on('create', (file) => {
        void this.handleFileCreate(file);
      }),
    );
  }

  onunload() {
    // No-op. Event cleanup is managed by registerEvent
  }

  private async handleFileCreate(file: TAbstractFile) {
    if (!(file instanceof TFile) || file.extension !== 'md') {
      return;
    }

    // Check rules in order of definition (priority order)
    const rules = this.plugin.settings.ejsRules;
    let matchedRule = null;

    for (const rule of rules) {
      if (!rule.pattern || !rule.templatePath) continue;
      try {
        const regex = new RegExp(rule.pattern);
        if (regex.test(file.path)) {
          matchedRule = rule;
          break; // First match wins
        }
      } catch (err) {
        console.error(`EJS Pattern regex error for rule ID ${rule.id}:`, err);
      }
    }

    if (!matchedRule) {
      return;
    }

    const templatesFolder =
      this.plugin.settings.ejsTemplatesFolder || '90 - Templates';
    let templatePath = matchedRule.templatePath;
    if (
      !templatePath
        .toLowerCase()
        .startsWith(templatesFolder.toLowerCase() + '/')
    ) {
      templatePath = `${templatesFolder}/${templatePath}`;
    }

    const templateFile =
      this.plugin.app.vault.getAbstractFileByPath(templatePath);

    if (!(templateFile instanceof TFile)) {
      new Notice(`EJS Template file not found: ${templatePath}`);
      return;
    }

    try {
      // 1. Read template content and compute SHA-256 hash
      const templateContent = await this.plugin.app.vault.read(templateFile);
      const calculatedHash = await this.calculateSHA256(templateContent);

      const storage = this.plugin.app as unknown as {
        loadLocalStorage: (key: string) => string | null;
        saveLocalStorage: (key: string, value: string) => void;
      };
      const allowedHashesRaw = storage.loadLocalStorage('ejs-allowed-hashes');
      const allowedHashes = allowedHashesRaw
        ? (JSON.parse(allowedHashesRaw) as Record<string, string>)
        : {};

      const isAllowed = allowedHashes[templatePath] === calculatedHash;

      if (!isAllowed) {
        // Block and ask user for security permission
        const approved = await this.promptSecurityApproval(
          templatePath,
          calculatedHash,
        );
        if (!approved) {
          new Notice(
            `EJS Template execution blocked for security: ${templatePath}`,
          );
          return;
        }

        // Save new hash to localStorage only
        allowedHashes[templatePath] = calculatedHash;
        storage.saveLocalStorage(
          'ejs-allowed-hashes',
          JSON.stringify(allowedHashes),
        );
        new Notice(`EJS Template hash approved: ${templatePath}`);
      }

      // 2. Define rendering context (locals)
      const locals = await this.buildRenderContext(file);

      // 3. Render template asynchronously
      const rendered = await ejs.render(templateContent, locals, {
        async: true,
      });

      // 4. Overwrite generated file content
      await this.plugin.app.vault.modify(file, rendered);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      new Notice(`EJS Rendering Error: ${errMsg}`);
      console.error('EJS Rendering error:', err);
    }
  }

  /**
   * Modular context builder for EJS template injection, allowing clean expansion.
   */
  private async buildRenderContext(
    file: TFile,
  ): Promise<Record<string, unknown>> {
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

  renderSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName('EJS 템플릿').setHeading();

    new Setting(containerEl)
      .setName('EJS 템플릿 폴더')
      .setDesc(
        '사용할 EJS 템플릿 파일들이 보관되어 있는 폴더 경로를 설정합니다 (예: Templates/EJS).',
      )
      .addText((text) => {
        new FolderSuggest(this.plugin.app, text.inputEl);
        text.setValue(this.plugin.settings.ejsTemplatesFolder || '');
        text.onChange(async (value) => {
          this.plugin.settings.ejsTemplatesFolder = value.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('승인된 템플릿 해시 초기화')
      .setDesc(
        '로컬 스토리지에 저장되어 실행이 승인된 모든 EJS 템플릿의 SHA-256 해시 목록을 초기화합니다.',
      )
      .addButton((button) => {
        button.setButtonText('해시 초기화').onClick(() => {
          const storage = this.plugin.app as unknown as {
            saveLocalStorage: (key: string, value: string) => void;
          };
          storage.saveLocalStorage('ejs-allowed-hashes', '');
          new Notice('모든 EJS 템플릿 해시가 성공적으로 초기화되었습니다.');
        });
        button.buttonEl.addClass('mod-warning');
      });

    // Rules header / explanation
    const rulesContainer = containerEl.createDiv('ejs-rules-container');
    new Setting(rulesContainer).setName('EJS 템플릿 규칙').setHeading();
    rulesContainer.createEl('p', {
      text: '새로 생성되는 파일의 경로 패턴을 기반으로 자동 적용할 EJS 템플릿 파일을 정규식(Regex)으로 매핑합니다. 규칙은 위에서부터 순서대로 적용되며, 가장 먼저 일치하는 규칙이 우선 적용됩니다.',
      cls: 'setting-item-description',
    });

    const renderRules = () => {
      rulesContainer.empty();

      const listEl = rulesContainer.createDiv('ejs-rules-list');

      this.plugin.settings.ejsRules.forEach((rule, idx) => {
        const ruleEl = listEl.createDiv('ejs-rule-item');

        // Fields container (Flex Group)
        const fieldsEl = ruleEl.createDiv('ejs-rules-fields');

        // 1. Pattern Field
        const patternFieldEl = fieldsEl.createDiv('ejs-rule-field');
        patternFieldEl.createSpan({ text: '정규식 패턴', cls: 'ejs-rule-label' });
        const patternInput = patternFieldEl.createEl('input', {
          type: 'text',
          placeholder: '^40 - Periodic/.*',
          value: rule.pattern,
        });
        patternInput.addEventListener('input', () => {
          rule.pattern = patternInput.value.trim();
          void this.plugin.saveSettings();
        });

        // 2. Template Path Field
        const pathFieldEl = fieldsEl.createDiv('ejs-rule-field');
        pathFieldEl.createSpan({ text: '템플릿 파일 경로', cls: 'ejs-rule-label' });
        
        const templatesFolder = this.plugin.settings.ejsTemplatesFolder || '90 - Templates';
        let displayPath = rule.templatePath;
        if (displayPath.toLowerCase().startsWith(templatesFolder.toLowerCase() + '/')) {
          displayPath = displayPath.slice(templatesFolder.length + 1);
        }

        const pathInput = pathFieldEl.createEl('input', {
          type: 'text',
          placeholder: '50 - Weekly.md',
          value: displayPath,
        });

        new FileSuggest(this.plugin.app, pathInput, templatesFolder);

        const updateTemplatePath = () => {
          let saveVal = pathInput.value.trim();
          if (saveVal.toLowerCase().startsWith(templatesFolder.toLowerCase() + '/')) {
            saveVal = saveVal.slice(templatesFolder.length + 1);
          }
          rule.templatePath = saveVal;
          void this.plugin.saveSettings();
          
          // Re-render status area for this rule dynamically
          void updateStatusArea();
        };

        pathInput.addEventListener('input', updateTemplatePath);

        // Footer container (Status area & controls)
        const footerEl = ruleEl.createDiv('ejs-rule-footer');

        // Status Area (Badge & Quick Approve Button)
        const statusAreaEl = footerEl.createDiv('ejs-rule-status-area');
        
        const updateStatusArea = async () => {
          statusAreaEl.empty();
          
          if (!rule.templatePath) {
            statusAreaEl.createSpan({ text: '경로 미입력', cls: 'ejs-rule-badge missing' });
            return;
          }

          let fullPath = rule.templatePath;
          if (!fullPath.toLowerCase().startsWith(templatesFolder.toLowerCase() + '/')) {
            fullPath = `${templatesFolder}/${fullPath}`;
          }

          const file = this.plugin.app.vault.getAbstractFileByPath(fullPath);
          if (!(file instanceof TFile)) {
            statusAreaEl.createSpan({ text: '파일 없음', cls: 'ejs-rule-badge missing' });
            return;
          }

          try {
            const content = await this.plugin.app.vault.read(file);
            const calculatedHash = await this.calculateSHA256(content);

            const storage = this.plugin.app as unknown as {
              loadLocalStorage: (key: string) => string | null;
              saveLocalStorage: (key: string, value: string) => void;
            };
            const allowedHashesRaw = storage.loadLocalStorage('ejs-allowed-hashes');
            const allowedHashes = allowedHashesRaw
              ? (JSON.parse(allowedHashesRaw) as Record<string, string>)
              : {};

            const isAllowed = allowedHashes[fullPath] === calculatedHash;

            if (isAllowed) {
              statusAreaEl.createSpan({ text: '실행 승인됨', cls: 'ejs-rule-badge approved' });
            } else {
              statusAreaEl.createSpan({ text: '승인 대기중', cls: 'ejs-rule-badge pending' });
              
              // Quick Approve Button
              const approveBtn = statusAreaEl.createEl('button', {
                text: '즉시 승인',
                cls: 'mod-cta btn-approve-quick',
              });
              approveBtn.addEventListener('click', () => {
                void (async () => {
                  allowedHashes[fullPath] = calculatedHash;
                  storage.saveLocalStorage('ejs-allowed-hashes', JSON.stringify(allowedHashes));
                  new Notice(`EJS 템플릿이 즉시 승인되었습니다: ${rule.templatePath}`);
                  await updateStatusArea();
                })();
              });
            }
          } catch {
            statusAreaEl.createSpan({ text: '해시 에러', cls: 'ejs-rule-badge missing' });
          }
        };

        // Trigger initial status check (asynchronous)
        void updateStatusArea();

        // Control Buttons
        const buttonGroup = footerEl.createDiv('ejs-rule-buttons');

        // Move Up
        if (idx > 0) {
          const upBtn = buttonGroup.createEl('button', { text: '↑' });
          upBtn.addEventListener('click', () => {
            const temp = this.plugin.settings.ejsRules[idx - 1]!;
            this.plugin.settings.ejsRules[idx - 1] = rule;
            this.plugin.settings.ejsRules[idx] = temp;
            void (async () => {
              await this.plugin.saveSettings();
              renderRules();
            })();
          });
        }

        // Move Down
        if (idx < this.plugin.settings.ejsRules.length - 1) {
          const downBtn = buttonGroup.createEl('button', { text: '↓' });
          downBtn.addEventListener('click', () => {
            const temp = this.plugin.settings.ejsRules[idx + 1]!;
            this.plugin.settings.ejsRules[idx + 1] = rule;
            this.plugin.settings.ejsRules[idx] = temp;
            void (async () => {
              await this.plugin.saveSettings();
              renderRules();
            })();
          });
        }

        // Delete
        const deleteBtn = buttonGroup.createEl('button', {
          text: '삭제',
          cls: 'mod-warning',
        });
        deleteBtn.addEventListener('click', () => {
          this.plugin.settings.ejsRules.splice(idx, 1);
          void (async () => {
            await this.plugin.saveSettings();
            renderRules();
          })();
        });
      });

      // Add Rule Button
      new Setting(rulesContainer).addButton((btn) => {
        btn
          .setButtonText('규칙 추가')
          .setCta()
          .onClick(() => {
            this.plugin.settings.ejsRules.push({
              id: Math.random().toString(36).substring(2, 9),
              pattern: '',
              templatePath: '',
            });
            void (async () => {
              await this.plugin.saveSettings();
              renderRules();
            })();
          });
      });
    };

    rulesContainer.addClass('ejs-rules-wrapper');
    renderRules();
  }
}
