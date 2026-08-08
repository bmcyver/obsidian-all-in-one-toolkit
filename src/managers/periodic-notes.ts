import { ensureDirectoryExists, isValidPath } from '../utils/file';
import { BaseManager } from './base';
import { FolderSuggest } from '../ui/folder-suggest';
import { DEFAULT_SETTINGS } from '../settings';
import { createToggleSection, addValidatedTextSetting } from '../utils/ui';

const PATH_PATTERNS = {
  weekly: (folder: string, year: string, week: string) =>
    `${folder}/${year}/00 - Weekly/W${week}.md`,
  monthly: (folder: string, year: string, month: string) =>
    `${folder}/${year}/${month}/${month}.md`,
  yearly: (folder: string, year: string) => `${folder}/${year}/${year}.md`,
};

type NoteType = 'weekly' | 'monthly' | 'yearly';

export class PeriodicNotesManager extends BaseManager {
  protected isEnabled(): boolean {
    return this.plugin.settings.periodicNotesEnabled;
  }

  onload() {
    this.plugin.addCommand({
      id: 'create-weekly-note',
      name: '주간 노트 열기',
      checkCallback: (checking) => {
        if (!this.isEnabled()) return false;
        if (!checking) {
          void this.getOrCreatePeriodicNote('weekly');
        }
        return true;
      },
    });

    this.plugin.addCommand({
      id: 'create-monthly-note',
      name: '월간 노트 열기',
      checkCallback: (checking) => {
        if (!this.isEnabled()) return false;
        if (!checking) {
          void this.getOrCreatePeriodicNote('monthly');
        }
        return true;
      },
    });

    this.plugin.addCommand({
      id: 'create-yearly-note',
      name: '연간 노트 열기',
      checkCallback: (checking) => {
        if (!this.isEnabled()) return false;
        if (!checking) {
          void this.getOrCreatePeriodicNote('yearly');
        }
        return true;
      },
    });
  }

  private async getOrCreatePeriodicNote(noteType: NoteType) {
    const now = window.moment();
    const year = now.format('YYYY');
    const folder =
      this.plugin.settings.periodicNotesFolder ||
      DEFAULT_SETTINGS.periodicNotesFolder;

    const pathGenerator: Record<NoteType, () => string> = {
      weekly: () => PATH_PATTERNS.weekly(folder, year, now.format('WW')),
      monthly: () => PATH_PATTERNS.monthly(folder, year, now.format('MM')),
      yearly: () => PATH_PATTERNS.yearly(folder, year),
    };
    const fullPath = pathGenerator[noteType]();

    let file = this.plugin.app.vault.getFileByPath(fullPath);

    if (!file) {
      await ensureDirectoryExists(this.plugin.app, fullPath);
      try {
        file = await this.plugin.app.vault.create(fullPath, '');
      } catch (err) {
        console.error(`Failed to create file at ${fullPath}`, err);
      }
    }

    if (file) {
      const leaf = this.plugin.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
  }

  renderSettings(containerEl: HTMLElement) {
    const detailEl = createToggleSection(
      containerEl,
      '주기적 노트',
      this.plugin.settings.periodicNotesEnabled,
      async (value) => {
        this.plugin.settings.periodicNotesEnabled = value;
        await this.plugin.saveSettings();
      },
    );

    addValidatedTextSetting(detailEl, {
      name: '주기적 노트 저장 폴더',
      desc: '주기적 노트가 저장될 폴더 경로를 설정합니다.',
      initialValue: this.plugin.settings.periodicNotesFolder || '',
      onSetupText: (text) => new FolderSuggest(this.plugin.app, text.inputEl),
      validate: (val) =>
        !isValidPath(val.trim())
          ? '경로에 사용할 수 없는 문자가 포함되어 있습니다.'
          : null,
      onChange: async (val) => {
        this.plugin.settings.periodicNotesFolder = val.trim();
        await this.plugin.saveSettings();
      },
    });
  }
}
