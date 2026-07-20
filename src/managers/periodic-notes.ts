import { TFile, Setting, Notice } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';
import { ensureDirectoryExists, isValidPath } from '../utils/file';
import { BaseManager } from './base';
import { FolderSuggest } from '../ui/folder-suggest';

const PATH_PATTERNS = {
  weekly: (folder: string, year: string, week: string) =>
    `${folder}/${year}/00 - Weekly/W${week}.md`,
  monthly: (folder: string, year: string, month: string) =>
    `${folder}/${year}/${month}/${month}.md`,
  yearly: (folder: string, year: string) => `${folder}/${year}/${year}.md`,
};

export class PeriodicNotesManager implements BaseManager {
  plugin: AllInOneToolkitPlugin;

  constructor(plugin: AllInOneToolkitPlugin) {
    this.plugin = plugin;
  }

  onload() {
    this.plugin.addCommand({
      id: 'create-weekly-note',
      name: '주간 노트 열기',
      callback: () => {
        void this.getOrCreatePeriodicNote('weekly');
      },
    });

    this.plugin.addCommand({
      id: 'create-monthly-note',
      name: '월간 노트 열기',
      callback: () => {
        void this.getOrCreatePeriodicNote('monthly');
      },
    });

    this.plugin.addCommand({
      id: 'create-yearly-note',
      name: '연간 노트 열기',
      callback: () => {
        void this.getOrCreatePeriodicNote('yearly');
      },
    });
  }

  onunload() {
    // No-op for now, but provides consistent lifecycle method
  }

  private async getOrCreatePeriodicNote(
    noteType: 'weekly' | 'monthly' | 'yearly',
  ) {
    const now = window.moment();
    const year = now.format('YYYY');
    const folder = this.plugin.settings.periodicNotesFolder || '40 - Periodic';

    let fullPath: string;
    if (noteType === 'weekly') {
      const week = now.format('WW');
      fullPath = PATH_PATTERNS.weekly(folder, year, week);
    } else if (noteType === 'monthly') {
      const month = now.format('MM');
      fullPath = PATH_PATTERNS.monthly(folder, year, month);
    } else {
      fullPath = PATH_PATTERNS.yearly(folder, year);
    }

    let file = this.plugin.app.vault.getAbstractFileByPath(fullPath);

    if (!file) {
      await ensureDirectoryExists(this.plugin.app, fullPath);
      try {
        file = await this.plugin.app.vault.create(fullPath, '');
      } catch (err) {
        console.error(`Failed to create file at ${fullPath}`, err);
      }
    }

    if (file instanceof TFile) {
      const leaf = this.plugin.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
  }

  renderSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName('주기적 노트').setHeading();

    new Setting(containerEl)
      .setName('주기적 노트 저장 폴더')
      .setDesc(
        '주기적 노트(주간/월간/연간)가 생성 및 저장될 폴더 경로를 설정합니다 (예: 40 - Periodic).',
      )
      .addText((text) => {
        new FolderSuggest(this.plugin.app, text.inputEl);
        text.setValue(this.plugin.settings.periodicNotesFolder || '');
        text.onChange(async (value) => {
          const trimmed = value.trim();
          if (!isValidPath(trimmed)) {
            new Notice('경로에 사용할 수 없는 문자가 포함되어 있습니다.');
            return;
          }
          this.plugin.settings.periodicNotesFolder = trimmed;
          await this.plugin.saveSettings();
        });
      });
  }
}
