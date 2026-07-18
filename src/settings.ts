import { App, PluginSettingTab, Setting, TextComponent } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type AllInOneToolkitPlugin from './main';
import { SUPPORTED_EXTENSIONS as FOLDER_NOTE_EXTENSIONS } from './managers/folder-notes';

export interface ToolkitSettings {
  // Image converter
  webpQuality: number;
  // Folder notes
  folderNoteExtension: string;
  // Scroll speed
  scrollSpeed: number;
}

export const DEFAULT_SETTINGS: ToolkitSettings = {
  webpQuality: 85,
  folderNoteExtension: 'md',
  scrollSpeed: 1,
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
  }
}
