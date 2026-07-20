import { TAbstractFile, TFile, Notice, moment } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';
import ejs from '../ejs/ejs';
import { EjsSecurityModal } from '../ui/security-modal';
import { EjsPromptModal } from '../ui/prompt-modal';
import { EjsSelectModal } from '../ui/select-modal';

interface AppLocalStorage {
  loadLocalStorage(key: string): string | null;
  saveLocalStorage(key: string, value: string): void;
}

export class EjsManager {
  private plugin: AllInOneToolkitPlugin;

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

    const templatePath = matchedRule.templatePath;
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
      
      const storage = this.plugin.app as unknown as AppLocalStorage;
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
      const locals = {
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
}
