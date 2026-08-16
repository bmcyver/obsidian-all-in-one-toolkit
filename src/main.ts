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

    // 1. Initialize Features and register as child components
    this.periodicNotes = this.addChild(new PeriodicNotesFeature(this));
    this.folderNotes = this.addChild(new FolderNoteFeature(this));
    this.imageConverter = this.addChild(new ImageConverterFeature(this));
    this.trashManager = this.addChild(new TrashManagerFeature(this));
    this.ejs = this.addChild(new EJSFeature(this));
    this.markdownlint = this.addChild(new MarkdownlintFeature(this));

    // 2. Register settings tab
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
