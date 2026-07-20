import {
  App,
  PluginSettingTab,
  Setting,
  TextComponent,
  Notice,
} from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type AllInOneToolkitPlugin from './main';
import { SUPPORTED_EXTENSIONS as FOLDER_NOTE_EXTENSIONS } from './managers/folder-notes';

interface AppLocalStorage {
  loadLocalStorage(key: string): string | null;
  saveLocalStorage(key: string, value: string): void;
}

export interface EjsRule {
  id: string;
  pattern: string;
  templatePath: string;
}

export interface ToolkitSettings {
  // Image converter
  webpQuality: number;
  // Folder notes
  folderNoteExtension: string;
  // Scroll speed
  scrollSpeed: number;
  // EJS Templates
  ejsTemplatesFolder: string;
  ejsRules: EjsRule[];
}

export const DEFAULT_SETTINGS: ToolkitSettings = {
  webpQuality: 85,
  folderNoteExtension: 'md',
  scrollSpeed: 1,
  ejsTemplatesFolder: 'Templates/EJS',
  ejsRules: [],
};

export class AllInOneToolkitSettingTab extends PluginSettingTab {
  plugin: AllInOneToolkitPlugin;

  constructor(app: App, plugin: AllInOneToolkitPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: 'group',
        heading: 'Image to WebP',
        items: [
          {
            name: 'WebP quality',
            desc: 'Set the quality of the converted WebP image (0-100). Higher quality means larger file size.',
            control: {
              type: 'number',
              key: 'webpQuality',
              defaultValue: 85,
              min: 0,
              max: 100,
            },
          },
        ],
      },
      {
        type: 'group',
        heading: 'Folder Notes',
        items: [
          {
            name: 'Default create extension',
            desc: 'Select the default file extension used when creating a new folder note (Ctrl/Cmd + Click).',
            control: {
              type: 'dropdown',
              key: 'folderNoteExtension',
              defaultValue: 'md',
              options: Object.fromEntries(
                FOLDER_NOTE_EXTENSIONS.map((ext) => [ext, `.${ext}`]),
              ),
            },
          },
        ],
      },
      {
        type: 'group',
        heading: 'Scroll Speed',
        items: [
          {
            name: 'Mouse scroll speed',
            desc: 'Adjust the mouse scroll speed (0.05 to 2). 1 is the default speed.',
            control: {
              type: 'number',
              key: 'scrollSpeed',
              defaultValue: 1,
              min: 0.05,
              max: 2,
            },
          },
        ],
      },
    ];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // 1. Image Conversion Settings
    new Setting(containerEl).setName('Image to WebP').setHeading();

    new Setting(containerEl)
      .setName('WebP quality')
      .setDesc(
        'Set the quality of the converted WebP image (0-100). Higher quality means larger file size.',
      )
      .addText((text) => {
        text.inputEl.type = 'number';
        text.inputEl.min = '0';
        text.inputEl.max = '100';
        text.setValue(String(this.plugin.settings.webpQuality));
        text.onChange(async (value) => {
          let num = parseInt(value, 10);
          if (isNaN(num)) return;
          num = Math.max(0, Math.min(100, num));
          this.plugin.settings.webpQuality = num;
          await this.plugin.saveSettings();
        });
      });

    // 2. Folder Notes Settings
    new Setting(containerEl).setName('Folder Notes').setHeading();

    new Setting(containerEl)
      .setName('Default create extension')
      .setDesc(
        'Select the default file extension used when creating a new folder note (Ctrl/Cmd + Click).',
      )
      .addDropdown((dropdown) => {
        FOLDER_NOTE_EXTENSIONS.forEach((ext) => {
          dropdown.addOption(ext, `.${ext}`);
        });
        dropdown.setValue(this.plugin.settings.folderNoteExtension);
        dropdown.onChange(async (value) => {
          this.plugin.settings.folderNoteExtension = value;
          await this.plugin.saveSettings();
        });
      });

    // 3. Scroll Speed Settings
    new Setting(containerEl).setName('Scroll Speed').setHeading();

    let scrollSpeedText: TextComponent;
    new Setting(containerEl)
      .setName('Mouse scroll speed')
      .setDesc(
        'Adjust the mouse scroll speed (0.05 to 2). 1 is the default speed.',
      )
      .addExtraButton((button) => {
        button
          .setIcon('reset')
          .setTooltip('Restore default')
          .onClick(async () => {
            this.plugin.settings.scrollSpeed = DEFAULT_SETTINGS.scrollSpeed;
            scrollSpeedText.setValue(String(DEFAULT_SETTINGS.scrollSpeed));
            await this.plugin.saveSettings();
          });
      })
      .addText((text) => {
        scrollSpeedText = text;
        text.inputEl.type = 'number';
        text.inputEl.min = '0.05';
        text.inputEl.max = '2';
        text.inputEl.step = '0.05';
        text.setValue(String(this.plugin.settings.scrollSpeed));
        text.onChange(async (value) => {
          let num = parseFloat(value);
          if (isNaN(num)) return;
          num = Math.max(0.05, Math.min(2, num));
          this.plugin.settings.scrollSpeed = num;
          await this.plugin.saveSettings();
        });
      });

    // 4. EJS Templates Settings
    new Setting(containerEl).setName('EJS Templates').setHeading();

    new Setting(containerEl)
      .setName('EJS Templates Folder')
      .setDesc(
        'Set the path to the folder containing your EJS templates (e.g. Templates/EJS).',
      )
      .addText((text) => {
        text.setValue(this.plugin.settings.ejsTemplatesFolder || '');
        text.onChange(async (value) => {
          this.plugin.settings.ejsTemplatesFolder = value.trim();
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Clear Approved Hashes')
      .setDesc(
        'Reset and clear all EJS template SHA-256 hashes approved in localStorage.',
      )
      .addButton((button) => {
        button.setButtonText('Clear Hashes').onClick(() => {
          const storage = this.app as unknown as AppLocalStorage;
          storage.saveLocalStorage('ejs-allowed-hashes', '');
          new Notice('All EJS template hashes cleared.');
        });
        button.buttonEl.addClass('mod-warning');
      });

    // Rules header / explanation
    const rulesContainer = containerEl.createDiv('ejs-rules-container');
    new Setting(rulesContainer).setName('EJS Template Rules').setHeading();
    rulesContainer.createEl('p', {
      text: 'Define regex patterns to map newly created file paths to EJS template files. Rules are checked sequentially from top to bottom. The first matching rule will be applied.',
      cls: 'setting-item-description',
    });

    const renderRules = () => {
      rulesContainer.empty();

      const listEl = rulesContainer.createDiv('ejs-rules-list');

      this.plugin.settings.ejsRules.forEach((rule, idx) => {
        const ruleEl = listEl.createDiv('ejs-rule-item');

        // Pattern Input
        new Setting(ruleEl).setName('Regex Pattern').addText((text) => {
          text
            .setPlaceholder('^40 - Periodic/.*')
            .setValue(rule.pattern)
            .onChange((val) => {
              rule.pattern = val;
              void this.plugin.saveSettings();
            });
        });

        // Template Path Input
        new Setting(ruleEl).setName('Template Path').addText((text) => {
          text
            .setPlaceholder('Templates/EJS/weekly.ejs')
            .setValue(rule.templatePath)
            .onChange((val) => {
              rule.templatePath = val;
              void this.plugin.saveSettings();
            });
        });

        // Order & Delete Buttons
        const buttonGroup = ruleEl.createDiv('ejs-rule-buttons');

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
          text: 'Delete',
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
          .setButtonText('Add Rule')
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

    renderRules();
  }
}
