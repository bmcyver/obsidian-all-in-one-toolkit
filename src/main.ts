import { Plugin } from 'obsidian';
import { AllInOneToolkitSettingTab, DEFAULT_SETTINGS } from './settings';
import type { ToolkitSettings } from './settings';
import type { Feature } from './shared/types';
import { PeriodicNotesFeature } from './features/periodic-notes';
import { FolderNoteFeature } from './features/folder-notes';
import { ImageConverterFeature } from './features/image-converter';
import { TrashManagerFeature } from './features/trash-manager';
import { EJSFeature } from './features/ejs';
import { MarkdownlintFeature } from './features/markdownlint';

export default class AllInOneToolkitPlugin extends Plugin {
  declare settings: ToolkitSettings;

  public periodicNotes!: PeriodicNotesFeature;
  public folderNotes!: FolderNoteFeature;
  public imageConverter!: ImageConverterFeature;
  public trashManager!: TrashManagerFeature;
  public ejs!: EJSFeature;
  public markdownlint!: MarkdownlintFeature;

  public get features(): Feature[] {
    return [
      this.periodicNotes,
      this.folderNotes,
      this.imageConverter,
      this.trashManager,
      this.ejs,
      this.markdownlint,
    ];
  }

  async onload() {
    await this.loadSettings();

    // 1. Initialize Feature instances
    this.periodicNotes = new PeriodicNotesFeature(this);
    this.folderNotes = new FolderNoteFeature(this);
    this.imageConverter = new ImageConverterFeature(this);
    this.trashManager = new TrashManagerFeature(this);
    this.ejs = new EJSFeature(this);
    this.markdownlint = new MarkdownlintFeature(this);

    // 2. Register and load all features when workspace layout is ready
    this.app.workspace.onLayoutReady(() => {
      for (const feature of this.features) {
        this.addChild(feature);
      }
    });

    // 3. Register settings tab
    this.addSettingTab(new AllInOneToolkitSettingTab(this.app, this));
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
    for (const feature of this.features) {
      feature.onSettingsUpdate();
    }
  }
}
