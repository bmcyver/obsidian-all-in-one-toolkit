import { TFile, Setting } from 'obsidian';
import { ensureDirectoryExists, isValidPath } from '../utils/file';
import { BaseManager } from './base';
import { FolderSuggest } from '../ui/folder-suggest';
import { DEFAULT_SETTINGS } from '../settings';

const PATH_PATTERNS = {
  weekly: (folder: string, year: string, week: string) =>
    `${folder}/${year}/00 - Weekly/W${week}.md`,
  monthly: (folder: string, year: string, month: string) =>
    `${folder}/${year}/${month}/${month}.md`,
  yearly: (folder: string, year: string) => `${folder}/${year}/${year}.md`,
};

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

  private async getOrCreatePeriodicNote(
    noteType: 'weekly' | 'monthly' | 'yearly',
  ) {
    const now = window.moment();
    const year = now.format('YYYY');
    const folder =
      this.plugin.settings.periodicNotesFolder ||
      DEFAULT_SETTINGS.periodicNotesFolder;

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
    new Setting(containerEl)
      .setName('주기적 노트')
      .setHeading()
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.periodicNotesEnabled)
          .onChange(async (value) => {
            this.plugin.settings.periodicNotesEnabled = value;
            await this.plugin.saveSettings();
            detailEl.style.display = value ? '' : 'none';
          });
      });

    const detailEl = containerEl.createDiv();
    detailEl.style.display = this.plugin.settings.periodicNotesEnabled
      ? ''
      : 'none';

    const folderSetting = new Setting(detailEl)
      .setName('주기적 노트 저장 폴더')
      .setDesc(
        '주기적 노트(주간/월간/연간)가 생성 및 저장될 폴더 경로를 설정합니다.',
      );
    folderSetting.settingEl.addClass('has-error-container');

    const folderErrorEl = folderSetting.settingEl.createDiv({
      cls: 'setting-item-error is-hidden',
    });

    folderSetting.addText((text) => {
      new FolderSuggest(this.plugin.app, text.inputEl);
      text.setValue(this.plugin.settings.periodicNotesFolder || '');
      text.onChange((value) => {
        void (async () => {
          const trimmed = value.trim();
          if (!isValidPath(trimmed)) {
            folderErrorEl.textContent =
              '경로에 사용할 수 없는 문자가 포함되어 있습니다.';
            folderErrorEl.removeClass('is-hidden');
            return;
          }
          folderErrorEl.addClass('is-hidden');
          folderErrorEl.textContent = '';
          this.plugin.settings.periodicNotesFolder = trimmed;
          await this.plugin.saveSettings();
        })();
      });
    });
  }
}
