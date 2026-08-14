import { Plugin } from 'obsidian';
import { AllInOneToolkitSettingTab, DEFAULT_SETTINGS } from './settings';
import type { ToolkitSettings } from './settings';
import { BaseManager } from './managers/base';
import { PeriodicNotesManager } from './managers/periodic-notes';
import { FolderNoteManager } from './managers/folder-notes';
import { ImageConverterManager } from './managers/image-converter';
import { TrashManager } from './managers/trash-manager';
import { EjsManager } from './managers/ejs-manager';
import { MarkdownlintManager } from './managers/markdownlint';

export default class AllInOneToolkitPlugin extends Plugin {
  declare settings: ToolkitSettings;
  public readonly managers: BaseManager[] = [];

  async onload() {
    await this.loadSettings();

    // 1. Initialize and register Managers in the array directly
    this.managers.push(
      new PeriodicNotesManager(this),
      new FolderNoteManager(this),
      new ImageConverterManager(this),
      new TrashManager(this),
      new EjsManager(this),
      new MarkdownlintManager(this),
    );

    // 2. Load all managers when layout is ready
    this.app.workspace.onLayoutReady(() => {
      for (const manager of this.managers) {
        manager.enable();
      }
    });

    // 3. Register settings tab
    this.addSettingTab(new AllInOneToolkitSettingTab(this.app, this));
  }

  onunload() {
    // Unload all managers in reverse order
    for (const manager of this.managers.toReversed()) {
      manager.disable();
    }
  }

  getManager<T extends BaseManager>(
    type: new (plugin: AllInOneToolkitPlugin) => T,
  ): T | undefined {
    return this.managers.find((m) => m instanceof type) as T | undefined;
  }

  async loadSettings() {
    const loadedData =
      ((await this.loadData()) as Partial<ToolkitSettings> | null) || {};
    const defaultSettings = structuredClone(DEFAULT_SETTINGS);

    this.settings = {
      ...defaultSettings,
      ...loadedData,
      markdownlintRules: {
        ...defaultSettings.markdownlintRules,
        ...(loadedData.markdownlintRules || {}),
      },
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
    for (const manager of this.managers) {
      manager.onSettingsUpdate();
    }
  }
}
