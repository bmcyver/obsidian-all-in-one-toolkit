import { Plugin } from 'obsidian';
import { AllInOneToolkitSettingTab } from './settings';
import type { ToolkitSettings } from './settings';
import { migrateSettings } from './utils/settings-migrator';
import { BaseManager } from './managers/base';
import { PeriodicNotesManager } from './managers/periodic-notes';
import { FolderNoteManager } from './managers/folder-notes';
import { ImageConverterManager } from './managers/image-converter';
import { TrashManager } from './managers/trash-manager';
import { ScrollManager } from './managers/scroll-manager';
import { EjsManager } from './managers/ejs-manager';

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
      new ScrollManager(this),
      new EjsManager(this),
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
    const data: unknown = await this.loadData();
    this.settings = migrateSettings(data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
    for (const manager of this.managers) {
      manager.onSettingsUpdate();
    }
  }
}
