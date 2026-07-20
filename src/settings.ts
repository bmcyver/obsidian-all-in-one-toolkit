import { App, PluginSettingTab } from 'obsidian';
import type AllInOneToolkitPlugin from './main';

export interface EjsRule {
  pattern: string;
  templatePath: string;
}

export interface ToolkitSettings {
  // Feature toggles
  periodicNotesEnabled: boolean;
  folderNoteEnabled: boolean;
  imageConverterEnabled: boolean;
  trashManagerEnabled: boolean;
  scrollEnabled: boolean;
  ejsEnabled: boolean;

  // Image converter
  webpQuality: number;
  imageStorePath: string;
  // Folder notes
  folderNoteExtension: string;
  // Scroll speed
  scrollSpeed: number;
  // EJS Templates
  ejsTemplatesFolder: string;
  ejsRules: EjsRule[];
  // Periodic notes
  periodicNotesFolder: string;
}

export const DEFAULT_SETTINGS: ToolkitSettings = {
  periodicNotesEnabled: true,
  folderNoteEnabled: true,
  imageConverterEnabled: true,
  trashManagerEnabled: true,
  scrollEnabled: true,
  ejsEnabled: true,

  webpQuality: 85,
  imageStorePath: '[assets]/YYYY',
  folderNoteExtension: 'md',
  scrollSpeed: 1,
  ejsTemplatesFolder: 'Templates',
  ejsRules: [],
  periodicNotesFolder: 'Periodic Notes',
};

export class AllInOneToolkitSettingTab extends PluginSettingTab {
  plugin: AllInOneToolkitPlugin;

  constructor(app: App, plugin: AllInOneToolkitPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Iterate over managers to dynamically render their settings
    this.plugin.managers.forEach((manager) => {
      manager.renderSettings(containerEl);
    });
  }
}
