import { TFile } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';
import { ensureDirectoryExists } from '../utils/file';

const PATH_PATTERNS = {
  weekly: (year: string, week: string) =>
    `40 - Periodic/${year}/00 - Weekly/W${week}.md`,
  monthly: (year: string, month: string) =>
    `40 - Periodic/${year}/${month}/${month}.md`,
  yearly: (year: string) => `40 - Periodic/${year}/${year}.md`,
};

export class PeriodicNotesManager {
  private plugin: AllInOneToolkitPlugin;

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

    let fullPath: string;
    if (noteType === 'weekly') {
      const week = now.format('WW');
      fullPath = PATH_PATTERNS.weekly(year, week);
    } else if (noteType === 'monthly') {
      const month = now.format('MM');
      fullPath = PATH_PATTERNS.monthly(year, month);
    } else {
      fullPath = PATH_PATTERNS.yearly(year);
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
}
