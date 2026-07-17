import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, AllInOneToolkitSettingTab } from './settings';
import type { ToolkitSettings } from './settings';
import { PeriodicNotesManager } from './managers/periodic-notes';
import { FolderNoteManager } from './managers/folder-notes';
import { ImageConverterManager } from './managers/image-converter';
import { TrashManager } from './managers/trash-manager';

interface PluginManager {
  onload(): void;
  onunload(): void;
}

export default class AllInOneToolkitPlugin extends Plugin {
  declare settings: ToolkitSettings;
  private managers: PluginManager[] = [];

  // Expose managers if other parts need them (like TrashManagerModal)
  periodicNotesManager!: PeriodicNotesManager;
  folderNoteManager!: FolderNoteManager;
  imageConverterManager!: ImageConverterManager;
  trashManager!: TrashManager;

  async onload() {
    await this.loadSettings();

    // 1. Initialize Managers
    this.periodicNotesManager = new PeriodicNotesManager(this);
    this.folderNoteManager = new FolderNoteManager(this);
    this.imageConverterManager = new ImageConverterManager(this);
    this.trashManager = new TrashManager(this);

    this.managers = [
      this.periodicNotesManager,
      this.folderNoteManager,
      this.imageConverterManager,
      this.trashManager,
    ];

    // 2. Load all managers
    for (const manager of this.managers) {
      manager.onload();
    }

    // 3. Register settings tab
    this.addSettingTab(new AllInOneToolkitSettingTab(this.app, this));
  }

  onunload() {
    // Unload all managers in reverse order
    for (const manager of this.managers.slice().reverse()) {
      manager.onunload();
    }
  }

  async loadSettings() {
    const data = (await this.loadData()) as {
      webpQuality?: number;
      quality?: number;
      folderNoteExtension?: string;
      defaultCreateExtension?: string;
    } | null;

    this.settings = {
      webpQuality:
        data?.webpQuality ?? data?.quality ?? DEFAULT_SETTINGS.webpQuality,
      folderNoteExtension:
        data?.folderNoteExtension ??
        data?.defaultCreateExtension ??
        DEFAULT_SETTINGS.folderNoteExtension,
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
