import {
  TFolder,
  TFile,
  type WorkspaceLeaf,
  Notice,
  normalizePath,
  Setting,
} from 'obsidian';
import type { WorkspaceWindow } from 'obsidian';
import { splitFileName } from '../utils/file';
import { BaseManager } from './base';
import { createToggleSection } from '../utils/ui';

export const SUPPORTED_EXTENSIONS = ['base', 'md', 'canvas'] as const;
const NAV_FILES_CONTAINER = '.nav-files-container';

export class FolderNoteManager extends BaseManager {
  private fileExplorerLeaves: WorkspaceLeaf[] = [];
  private observers: MutationObserver[] = [];
  private frameId: number | null = null;
  private refreshPending = false;
  private windows: Set<Window> = new Set();
  private folderNotePaths: Set<string> = new Set();

  protected isEnabled(): boolean {
    return this.plugin.settings.folderNoteEnabled;
  }

  onSettingsUpdate() {
    super.onSettingsUpdate();
    if (this.isEnabled()) {
      this.rebuildFolderNotePathsCache();
    }
    this.triggerStyleRefresh();
  }

  onload() {
    this.bindObservers();

    this.registerEventRef(
      this.plugin.app.workspace.on('layout-change', () => {
        if (this.isEnabled()) {
          this.bindObservers();
        }
      }),
    );

    this.rebuildFolderNotePathsCache();

    window.addEventListener('click', this.onClick, { capture: true });
    this.windows.add(window);

    this.registerEventRef(
      this.plugin.app.workspace.on('window-open', this.windowOpenListener),
    );

    this.registerEventRef(
      this.plugin.app.vault.on('create', (file) => {
        if (!this.isEnabled()) return;
        if (file instanceof TFile && this.isFolderNotePath(file.path)) {
          this.folderNotePaths.add(file.path);
          this.triggerStyleRefresh();
        }
      }),
    );

    this.registerEventRef(
      this.plugin.app.vault.on('delete', (file) => {
        if (!this.isEnabled()) return;
        if (file instanceof TFile && this.isFolderNotePath(file.path)) {
          this.folderNotePaths.delete(file.path);
          this.triggerStyleRefresh();
        }
      }),
    );

    this.registerEventRef(
      this.plugin.app.vault.on('rename', (file, oldPath) => {
        if (!this.isEnabled()) return;
        if (file instanceof TFile) {
          let changed = false;
          if (this.isFolderNotePath(oldPath)) {
            this.folderNotePaths.delete(oldPath);
            changed = true;
          }
          if (this.isFolderNotePath(file.path)) {
            this.folderNotePaths.add(file.path);
            changed = true;
          }
          if (changed) {
            this.triggerStyleRefresh();
          }
        }
      }),
    );

    this.registerEventRef(
      this.plugin.app.workspace.on('file-menu', (menu, folder) => {
        if (!this.isEnabled()) return;
        if (!(folder instanceof TFolder)) return;

        const noteFile = this.getFolderNoteFile(folder.path);
        if (!noteFile) {
          menu.addItem((item) => {
            item
              .setTitle('폴더 노트 생성')
              .setIcon('document')
              .onClick(() => {
                void this.createNewFolderNote(folder.path);
              });
          });
        } else {
          menu.addItem((item) => {
            item
              .setTitle('폴더 노트 삭제')
              .setIcon('trash')
              .onClick(() => {
                void this.deleteFolderNote(noteFile);
              });
          });
        }
      }),
    );
  }

  onunload() {
    this.disconnectObservers();
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    for (const win of this.windows) {
      try {
        win.removeEventListener('click', this.onClick, { capture: true });
      } catch {
        // ignore
      }
    }
    this.windows.clear();
    this.folderNotePaths.clear();
    this.clearFolderStyles();
  }

  private windowOpenListener = (_win: WorkspaceWindow, win: Window) => {
    if (!this.isEnabled()) return;
    win.addEventListener('click', this.onClick, { capture: true });
    this.windows.add(win);

    const handleClose = () => {
      try {
        win.removeEventListener('click', this.onClick, { capture: true });
        win.removeEventListener('unload', handleClose);
      } catch {
        // ignore
      }
      this.windows.delete(win);
    };
    win.addEventListener('unload', handleClose);
  };

  private normalizeFolderPath(path: string): string {
    const normalized = normalizePath(path);
    return normalized === '/' ? '' : normalized;
  }

  private clearFolderStyles() {
    for (const leaf of this.fileExplorerLeaves) {
      const container =
        leaf.view.containerEl.querySelector(NAV_FILES_CONTAINER);
      if (!container) continue;

      container.querySelectorAll('.fn-hidden-file').forEach((el) => {
        el.classList.remove('fn-hidden-file');
      });

      container.querySelectorAll('.has-folder-note').forEach((el) => {
        el.classList.remove('has-folder-note');
      });
    }
  }

  private disconnectObservers() {
    for (const observer of this.observers) {
      observer.disconnect();
    }
    this.observers = [];
  }

  private bindObservers() {
    this.disconnectObservers();
    this.fileExplorerLeaves =
      this.plugin.app.workspace.getLeavesOfType('file-explorer');

    for (const leaf of this.fileExplorerLeaves) {
      const container =
        leaf.view.containerEl.querySelector(NAV_FILES_CONTAINER);
      if (!container) continue;

      this.scheduleRefresh();

      const observer = new MutationObserver(() => {
        this.scheduleRefresh();
      });

      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-path'],
      });
      this.observers.push(observer);
    }
  }

  private scheduleRefresh() {
    this.refreshPending = true;
    if (this.frameId !== null) return;
    this.frameId = window.requestAnimationFrame(() => {
      if (this.refreshPending) {
        this.refreshFolderStyles();
      }
      this.refreshPending = false;
      this.frameId = null;
    });
  }

  private onClick = (evt: MouseEvent) => {
    if (!this.isEnabled()) return;
    const target = evt.target as HTMLElement;

    const container = target.closest(NAV_FILES_CONTAINER);
    if (container) {
      this.handleExplorerClick(evt, target);
    }
  };

  private handleExplorerClick(evt: MouseEvent, target: HTMLElement) {
    if (
      target.closest('.nav-folder-collapse-indicator') ||
      target.closest('.collapse-icon')
    ) {
      return;
    }

    const titleEl = target.closest('.nav-folder-title');
    if (!titleEl) return;

    const path = titleEl.getAttribute('data-path');
    if (!path) return;

    const folderPath = this.normalizeFolderPath(path);
    const folder = this.plugin.app.vault.getFolderByPath(folderPath || '/');
    if (!folder) return;

    const noteFile = this.getFolderNoteFile(folder.path);
    if (noteFile) {
      evt.stopPropagation();
      evt.preventDefault();
      void this.openFolderNote(noteFile, evt.ctrlKey || evt.metaKey);
    } else if (evt.ctrlKey || evt.metaKey) {
      evt.stopPropagation();
      evt.preventDefault();
      void this.createNewFolderNote(folder.path);
    }
  }

  triggerStyleRefresh() {
    if (!this.isEnabled()) {
      this.clearFolderStyles();
      return;
    }
    this.scheduleRefresh();
  }

  private rebuildFolderNotePathsCache() {
    this.folderNotePaths.clear();
    const files = this.plugin.app.vault.getFiles();
    for (const file of files) {
      if (this.isFolderNotePath(file.path)) {
        this.folderNotePaths.add(file.path);
      }
    }
  }

  private refreshFolderStyles() {
    if (!this.isEnabled()) return;

    for (const leaf of this.fileExplorerLeaves) {
      const container =
        leaf.view.containerEl.querySelector(NAV_FILES_CONTAINER);
      if (!container) continue;

      const fileElements = container.querySelectorAll('.nav-file');
      for (let i = 0; i < fileElements.length; i++) {
        const el = fileElements[i]!;
        const titleEl = el.querySelector(':scope > .nav-file-title');
        if (!titleEl) continue;
        const path = titleEl.getAttribute('data-path');
        if (!path) continue;

        const isNote = this.isFolderNotePath(path);
        const hasClass = el.classList.contains('fn-hidden-file');

        if (isNote && !hasClass) {
          el.classList.add('fn-hidden-file');
        } else if (!isNote && hasClass) {
          el.classList.remove('fn-hidden-file');
        }
      }

      const folderElements = container.querySelectorAll('.nav-folder');
      for (let i = 0; i < folderElements.length; i++) {
        const el = folderElements[i]!;
        const titleEl = el.querySelector(':scope > .nav-folder-title');
        if (!titleEl) continue;

        const path = titleEl.getAttribute('data-path');
        if (path === null) continue;
        const normalizedPath = this.normalizeFolderPath(path);
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        const folderName =
          lastSlashIndex >= 0
            ? normalizedPath.slice(lastSlashIndex + 1)
            : normalizedPath;

        let hasNote = false;
        if (normalizedPath && folderName && folderName !== '/') {
          const prefix = `${normalizedPath}/${folderName}.`;
          for (let j = 0; j < SUPPORTED_EXTENSIONS.length; j++) {
            if (this.folderNotePaths.has(prefix + SUPPORTED_EXTENSIONS[j])) {
              hasNote = true;
              break;
            }
          }
        }

        const hasClass = titleEl.classList.contains('has-folder-note');

        if (hasNote && !hasClass) {
          titleEl.classList.add('has-folder-note');
        } else if (!hasNote && hasClass) {
          titleEl.classList.remove('has-folder-note');
        }
      }
    }
  }

  isFolderNotePath(filePath: string): boolean {
    const normalized = filePath.replace(/\/+$/, '');
    const lastSlash = normalized.lastIndexOf('/');
    const fileNameWithExt =
      lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;

    const parentSlash =
      lastSlash >= 0 ? normalized.lastIndexOf('/', lastSlash - 1) : -1;
    const parentFolderName =
      lastSlash >= 0
        ? parentSlash >= 0
          ? normalized.slice(parentSlash + 1, lastSlash)
          : normalized.slice(0, lastSlash)
        : '';

    const parsed = splitFileName(fileNameWithExt);
    if (!parsed) return false;

    return (
      parentFolderName !== '' &&
      parsed.baseName === parentFolderName &&
      (SUPPORTED_EXTENSIONS as readonly string[]).includes(
        parsed.ext.toLowerCase(),
      )
    );
  }

  getFolderNoteFile(folderPath: string): TFile | null {
    const normalized = this.normalizeFolderPath(folderPath);
    if (!normalized) return null;

    const lastSlash = normalized.lastIndexOf('/');
    const folderName =
      lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
    if (!folderName || folderName === '/') return null;

    const prefix = `${normalized}/${folderName}.`;
    for (const ext of SUPPORTED_EXTENSIONS) {
      const potentialPath = prefix + ext;
      if (this.folderNotePaths.has(potentialPath)) {
        const file = this.plugin.app.vault.getFileByPath(potentialPath);
        if (file) return file;
      }
    }

    return null;
  }

  async createNewFolderNote(folderPath: string) {
    const normalized = this.normalizeFolderPath(folderPath);
    const folder = this.plugin.app.vault.getFolderByPath(normalized || '/');
    if (!folder) return;

    const folderName = folder.name;
    if (!normalized || folderName === '/') return;

    const defaultExt =
      this.plugin.settings.folderNoteExtension ||
      SUPPORTED_EXTENSIONS[0] ||
      'base';
    const notePath = `${normalized}/${folderName}.${defaultExt}`;

    try {
      const newFile = await this.plugin.app.vault.create(notePath, '');
      await this.openFolderNote(newFile, false);
      this.triggerStyleRefresh();
    } catch (err) {
      new Notice(`폴더 노트 생성 실패: ${(err as Error).message}`);
    }
  }

  async deleteFolderNote(noteFile: TFile) {
    try {
      await this.plugin.app.fileManager.trashFile(noteFile);
      this.triggerStyleRefresh();
    } catch (err) {
      new Notice(`폴더 노트 삭제 실패: ${(err as Error).message}`);
    }
  }

  async openFolderNote(file: TFile, newLeaf: boolean) {
    const leaf = this.plugin.app.workspace.getLeaf(newLeaf);
    await leaf.openFile(file);
  }

  renderSettings(containerEl: HTMLElement) {
    const detailEl = createToggleSection(
      containerEl,
      '폴더 노트',
      this.plugin.settings.folderNoteEnabled,
      async (value) => {
        this.plugin.settings.folderNoteEnabled = value;
        await this.plugin.saveSettings();
      },
    );

    new Setting(detailEl)
      .setName('기본 확장자')
      .setDesc('폴더 노트 생성 시 사용할 기본 확장자를 선택합니다.')
      .addDropdown((dropdown) => {
        const options = Object.fromEntries(
          SUPPORTED_EXTENSIONS.map((ext) => [ext, `.${ext}`]),
        );
        dropdown.addOptions(options);
        dropdown.setValue(this.plugin.settings.folderNoteExtension);
        dropdown.onChange(async (value) => {
          this.plugin.settings.folderNoteExtension = value;
          await this.plugin.saveSettings();
        });
      });
  }
}
