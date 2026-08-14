import { App, PluginSettingTab } from 'obsidian';
import type AllInOneToolkitPlugin from './main';
import { DEFAULT_MARKDOWNLINT_RULES } from './constants/markdownlint-rules';

export type {
  MarkdownlintSubOptionMetadata,
  MarkdownlintRuleMetadata,
} from './constants/markdownlint-rules';
export {
  MARKDOWNLINT_ALL_RULES,
  DEFAULT_MARKDOWNLINT_RULES,
  getRuleDocUrl,
} from './constants/markdownlint-rules';

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
  ejsEnabled: boolean;
  markdownlintEnabled: boolean;

  // Image converter
  webpQuality: number;
  imageStorePath: string;
  // Folder notes
  folderNoteExtension: string;
  // EJS Templates
  ejsTemplatesFolder: string;
  ejsRules: EjsRule[];
  // Periodic notes
  periodicNotesFolder: string;
  // Markdownlint
  autofixOnSave: boolean;
  markdownlintIgnoredFolders: string[];
  markdownlintRules: Record<string, boolean | Record<string, unknown>>;
}

export const DEFAULT_SETTINGS: ToolkitSettings = {
  periodicNotesEnabled: true,
  folderNoteEnabled: true,
  imageConverterEnabled: true,
  trashManagerEnabled: true,
  ejsEnabled: true,
  markdownlintEnabled: true,

  webpQuality: 85,
  imageStorePath: '[assets]/YYYY',
  folderNoteExtension: 'md',
  ejsTemplatesFolder: 'Templates',
  ejsRules: [],
  periodicNotesFolder: 'Periodic Notes',
  autofixOnSave: true,
  markdownlintIgnoredFolders: [],
  markdownlintRules: { ...DEFAULT_MARKDOWNLINT_RULES },
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

    this.plugin.managers.forEach((manager) => {
      manager.renderSettings(containerEl);
    });
  }
}
