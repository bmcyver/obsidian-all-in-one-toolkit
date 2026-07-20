import { App, PluginSettingTab } from 'obsidian';
import type AllInOneToolkitPlugin from './main';

export interface EjsRule {
  id: string;
  pattern: string;
  templatePath: string;
}

export interface ToolkitSettings {
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
  webpQuality: 85,
  imageStorePath: 'assets/YYYY',
  folderNoteExtension: 'md',
  scrollSpeed: 1,
  ejsTemplatesFolder: 'Templates/EJS',
  ejsRules: [],
  periodicNotesFolder: '40 - Periodic',
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
