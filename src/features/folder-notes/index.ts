import {
  TFolder,
  TFile,
  type WorkspaceLeaf,
  Notice,
  normalizePath,
  Setting,
} from 'obsidian';
import type { WorkspaceWindow } from 'obsidian';
import { Feature } from '../../shared/types';
import { createToggleSection } from '../../shared/ui/settings-helpers';
import { PromptModal } from '../../shared/ui/prompt-modal';

export const SUPPORTED_EXTENSIONS = ['base', 'md', 'canvas'] as const;
const NAV_FILES_CONTAINER = '.nav-files-container';

export class FolderNoteFeature extends Feature {
  private fileExplorerLeaves: WorkspaceLeaf[] = [];
  private observers: MutationObserver[] = [];
  private frameId: number | null = null;
  private refreshPending = false;
  private windows: Set<Window> = new Set();
  private folderNotePaths: Set<string> = new Set();

  private isEnabled(): boolean {
    return this.plugin.settings.folderNoteEnabled;
  }

  override onSettingsUpdate() {
    if (this.isEnabled()) {
      this.rebuildFolderNotePathsCache();
    }
    this.triggerStyleRefresh();
  }

  onload() {
    this.bindObservers();

    this.plugin.addCommand({
      id: 'folder-note-rename',
      name: '폴더 노트 이름 변경',
      checkCallback: (checking) => {
        if (!this.isEnabled()) return false;
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) return false;

        let folder: TFolder | null = null;
        let noteFile: TFile | null = null;

        if (this.isFolderNotePath(activeFile.path)) {
          noteFile = activeFile;
          if (activeFile.parent instanceof TFolder) {
            folder = activeFile.parent;
          }
        } else {
          const parentFolder = activeFile.parent;
          if (parentFolder instanceof TFolder) {
            const foundNote = this.getFolderNoteFile(parentFolder.path);
            if (foundNote) {
              folder = parentFolder;
              noteFile = foundNote;
            }
          }
        }

        if (!folder || !noteFile) return false;

        if (!checking) {
          void this.promptRenameFolderNote(folder, noteFile);
        }
        return true;
      },
    });

    this.registerEvent(
      this.plugin.app.workspace.on('layout-change', () => {
        if (this.isEnabled()) {
          this.bindObservers();
        }
      }),
    );

    this.rebuildFolderNotePathsCache();

    window.addEventListener('click', this.onClick, { capture: true });
    this.windows.add(window);

    this.registerEvent(
      this.plugin.app.workspace.on('window-open', this.windowOpenListener),
    );

    this.registerEvent(
      this.plugin.app.vault.on('create', (file) => {
        if (!this.isEnabled()) return;
        if (file instanceof TFile && this.isFolderNotePath(file.path)) {
          this.folderNotePaths.add(file.path);
          this.triggerStyleRefresh();
        }
      }),
    );

    this.registerEvent(
      this.plugin.app.vault.on('delete', (file) => {
        if (!this.isEnabled()) return;
        if (file instanceof TFile && this.isFolderNotePath(file.path)) {
          this.folderNotePaths.delete(file.path);
          this.triggerStyleRefresh();
        }
      }),
    );

    this.registerEvent(
      this.plugin.app.vault.on('rename', (file, oldPath) => {
        if (!this.isEnabled()) return;
        if (file instanceof TFolder) {
          const oldNormalized = this.normalizeFolderPath(oldPath);
          const oldFolderName = this.getFolderName(oldNormalized);
          const newFolderName = file.name;

          if (
            oldFolderName &&
            newFolderName &&
            oldFolderName !== newFolderName
          ) {
            for (const ext of SUPPORTED_EXTENSIONS) {
              const expectedOldNotePath = `${file.path}/${oldFolderName}.${ext}`;
              const noteFile =
                this.plugin.app.vault.getFileByPath(expectedOldNotePath);
              if (noteFile) {
                const targetNotePath = `${file.path}/${newFolderName}.${ext}`;
                void this.plugin.app.fileManager.renameFile(
                  noteFile,
                  targetNotePath,
                );
                break;
              }
            }
          }
          this.rebuildFolderNotePathsCache();
          this.triggerStyleRefresh();
        } else if (file instanceof TFile) {
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

    this.registerEvent(
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
              .setTitle('폴더 노트 이름 변경')
              .setIcon('pencil')
              .onClick(() => {
                void this.promptRenameFolderNote(folder, noteFile);
              });
          });
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

  private getFolderName(normalizedPath: string): string {
    const lastSlash = normalizedPath.lastIndexOf('/');
    return lastSlash >= 0
      ? normalizedPath.slice(lastSlash + 1)
      : normalizedPath;
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

        el.classList.toggle('fn-hidden-file', this.folderNotePaths.has(path));
      }

      const folderElements = container.querySelectorAll('.nav-folder');
      for (let i = 0; i < folderElements.length; i++) {
        const el = folderElements[i]!;
        const titleEl = el.querySelector(':scope > .nav-folder-title');
        if (!titleEl) continue;

        const path = titleEl.getAttribute('data-path');
        if (path === null) continue;
        const normalizedPath = this.normalizeFolderPath(path);
        const folderName = this.getFolderName(normalizedPath);

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

        titleEl.classList.toggle('has-folder-note', hasNote);
      }
    }
  }

  isFolderNotePath(filePath: string): boolean {
    const normalized = normalizePath(filePath);
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash <= 0) return false;

    const parentSlash = normalized.lastIndexOf('/', lastSlash - 1);
    const parentFolderName =
      parentSlash >= 0
        ? normalized.slice(parentSlash + 1, lastSlash)
        : normalized.slice(0, lastSlash);

    const fileNameWithExt = normalized.slice(lastSlash + 1);
    const lastDot = fileNameWithExt.lastIndexOf('.');
    if (lastDot <= 0) return false;

    const baseName = fileNameWithExt.slice(0, lastDot);
    const ext = fileNameWithExt.slice(lastDot + 1).toLowerCase();

    return (
      parentFolderName !== '' &&
      baseName === parentFolderName &&
      (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)
    );
  }

  getFolderNoteFile(folderPath: string): TFile | null {
    const normalized = this.normalizeFolderPath(folderPath);
    if (!normalized) return null;

    const folderName = this.getFolderName(normalized);
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

  async promptRenameFolderNote(folder: TFolder, noteFile: TFile) {
    new PromptModal(
      this.plugin.app,
      '폴더 및 노트 이름 변경',
      folder.name,
      (newName) => {
        if (
          !newName ||
          newName.trim() === '' ||
          newName.trim() === folder.name
        ) {
          return;
        }
        void this.renameFolderNote(folder, noteFile, newName.trim());
      },
    ).open();
  }

  async renameFolderNote(folder: TFolder, noteFile: TFile, newName: string) {
    const parentPath = folder.parent ? folder.parent.path : '';
    const normalizedParent = this.normalizeFolderPath(parentPath);
    const newFolderPath = normalizedParent
      ? `${normalizedParent}/${newName}`
      : newName;

    if (this.plugin.app.vault.getFolderByPath(newFolderPath)) {
      new Notice(`'${newName}' 폴더가 이미 존재합니다.`);
      return;
    }

    try {
      const ext = noteFile.extension;
      await this.plugin.app.fileManager.renameFile(folder, newFolderPath);

      const movedNotePath = `${newFolderPath}/${folder.name}.${ext}`;
      const movedNoteFile = this.plugin.app.vault.getFileByPath(movedNotePath);

      const targetNotePath = `${newFolderPath}/${newName}.${ext}`;
      if (movedNoteFile) {
        await this.plugin.app.fileManager.renameFile(
          movedNoteFile,
          targetNotePath,
        );
      }

      this.rebuildFolderNotePathsCache();
      this.triggerStyleRefresh();
      new Notice(`폴더 및 노트 이름이 '${newName}'(으)로 변경되었습니다.`);
    } catch (err) {
      new Notice(`폴더 노트 이름 변경 실패: ${(err as Error).message}`);
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
