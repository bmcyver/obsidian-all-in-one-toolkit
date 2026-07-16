import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, AllInOneToolkitSettingTab } from './settings';
import type { ToolkitSettings } from './settings';
import { PeriodicNotesManager } from './periodic-notes';
import { FolderNoteManager } from './folder-notes';
import { ImageConverterManager } from './image-converter';
import { TrashManager } from './trash-manager';

export default class AllInOneToolkitPlugin extends Plugin {
  declare settings: ToolkitSettings;
  private periodicNotesManager!: PeriodicNotesManager;
  private folderNoteManager!: FolderNoteManager;
  private imageConverterManager!: ImageConverterManager;
  private trashManager!: TrashManager;

  async onload() {
    await this.loadSettings();

    // 1. Initialize Periodic Notes Manager
    this.periodicNotesManager = new PeriodicNotesManager(this);
    this.periodicNotesManager.onload();

    // 2. Initialize Folder Notes Manager
    this.folderNoteManager = new FolderNoteManager(this);
    this.folderNoteManager.onload();

    // 3. Initialize Image Converter Manager
    this.imageConverterManager = new ImageConverterManager(this);
    this.imageConverterManager.onload();

    // 4. Initialize Trash Manager
    this.trashManager = new TrashManager(this);
    this.trashManager.onload();

    // 5. Register settings tab
    this.addSettingTab(new AllInOneToolkitSettingTab(this.app, this));
  }

  onunload() {
    if (this.folderNoteManager) {
      this.folderNoteManager.onunload();
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

  async ensureDirectoryExists(filePath: string) {
    const parts = filePath.split('/').filter((p) => p);
    if (parts.length <= 1) return;

    // Remove filename
    parts.pop();

    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const exists = this.app.vault.getAbstractFileByPath(currentPath);
      if (!exists) {
        try {
          await this.app.vault.createFolder(currentPath);
        } catch {
          // Ignore folder exists error
        }
      }
    }
  }
}
