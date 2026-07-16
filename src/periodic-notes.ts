import { TFile } from 'obsidian';
import type AllInOneToolkitPlugin from './main';

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

  private async getOrCreatePeriodicNote(
    noteType: 'weekly' | 'monthly' | 'yearly',
  ) {
    const now = window.moment();
    const year = now.format('YYYY');

    let fullPath: string;
    if (noteType === 'weekly') {
      const week = now.format('WW');
      fullPath = `40 - Periodic/${year}/00 - Weekly/W${week}.md`;
    } else if (noteType === 'monthly') {
      const month = now.format('MM');
      fullPath = `40 - Periodic/${year}/${month}/${month}.md`;
    } else {
      fullPath = `40 - Periodic/${year}/${year}.md`;
    }

    let file = this.plugin.app.vault.getAbstractFileByPath(fullPath);

    if (!file) {
      await this.plugin.ensureDirectoryExists(fullPath);
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
