import { Notice, Setting } from 'obsidian';
import { ensureDirectoryExists, isValidPath } from '../../shared/utils/file';
import { Feature } from '../../shared/types';
import { FolderSuggest } from '../../shared/ui/folder-suggest';
import { DEFAULT_SETTINGS } from '../../settings';
import {
  createToggleSection,
  addErrorContainer,
  showError,
  clearError,
} from '../../shared/ui/settings-helpers';

type NoteType = 'weekly' | 'monthly' | 'yearly';

export class PeriodicNotesFeature extends Feature {
  private isEnabled(): boolean {
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

  private getPeriodicNotePath(
    noteType: NoteType,
    folder: string,
    now: ReturnType<typeof window.moment>,
  ): string {
    const year = now.format('YYYY');
    switch (noteType) {
      case 'weekly':
        return `${folder}/${year}/00 - Weekly/W${now.format('WW')}.md`;
      case 'monthly':
        return `${folder}/${year}/${now.format('MM')}/${now.format('MM')}.md`;
      case 'yearly':
        return `${folder}/${year}/${year}.md`;
    }
  }

  private async getOrCreatePeriodicNote(noteType: NoteType) {
    const now = window.moment();
    const folder =
      this.plugin.settings.periodicNotesFolder ||
      DEFAULT_SETTINGS.periodicNotesFolder;

    const fullPath = this.getPeriodicNotePath(noteType, folder, now);
    let file = this.plugin.app.vault.getFileByPath(fullPath);

    if (!file) {
      await ensureDirectoryExists(this.plugin.app, fullPath);
      try {
        file = await this.plugin.app.vault.create(fullPath, '');
      } catch (err) {
        new Notice(`노트 생성 실패: ${(err as Error).message}`);
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

    const setting = new Setting(detailEl)
      .setName('주기적 노트 저장 폴더')
      .setDesc('주기적 노트가 저장될 폴더 경로를 설정합니다.');

    const errorEl = addErrorContainer(setting);

    setting.addText((text) => {
      text.setValue(this.plugin.settings.periodicNotesFolder || '');
      new FolderSuggest(this.plugin.app, text.inputEl);

      text.onChange((val) => {
        void (async () => {
          const trimmed = val.trim();
          if (!isValidPath(trimmed)) {
            showError(
              errorEl,
              '경로에 사용할 수 없는 문자가 포함되어 있습니다.',
            );
            return;
          }
          clearError(errorEl);
          this.plugin.settings.periodicNotesFolder = trimmed;
          await this.plugin.saveSettings();
        })();
      });
    });
  }
}
