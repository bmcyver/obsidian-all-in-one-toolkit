import { TFolder, TFile, type WorkspaceLeaf, Notice } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';
import { splitFileName } from '../utils/file';

export const SUPPORTED_EXTENSIONS = ['base', 'md', 'canvas'];

export class FolderNoteManager {
  private plugin: AllInOneToolkitPlugin;
  private fileExplorerLeaves: WorkspaceLeaf[] = [];
  private observers: MutationObserver[] = [];
  private frameId: number | null = null;

  constructor(plugin: AllInOneToolkitPlugin) {
    this.plugin = plugin;
  }

  onload() {
    this.plugin.app.workspace.onLayoutReady(() => {
      this.bindObservers();
      this.plugin.registerEvent(
        this.plugin.app.workspace.on('layout-change', () =>
          this.bindObservers(),
        ),
      );
    });

    // Register click event listener on the active document
    this.plugin.registerDomEvent(activeDocument, 'click', this.onClick, {
      capture: true,
    });

    this.plugin.registerEvent(
      this.plugin.app.workspace.on('file-menu', (menu, folder) => {
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
              .setTitle('폴더 노트 제거')
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
    }
    this.clearFolderStyles();
  }

  private clearFolderStyles() {
    for (const leaf of this.fileExplorerLeaves) {
      const container = leaf.view.containerEl.querySelector(
        '.nav-files-container',
      );
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
      const container = leaf.view.containerEl.querySelector(
        '.nav-files-container',
      );
      if (!container) continue;

      this.scheduleRefresh(container);

      const observer = new MutationObserver((mutations) => {
        const shouldRefresh = mutations.some(
          (m) =>
            m.addedNodes.length > 0 ||
            m.removedNodes.length > 0 ||
            (m.type === 'attributes' && m.attributeName === 'data-path'),
        );

        if (shouldRefresh) {
          this.scheduleRefresh(container);
        }
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

  private scheduleRefresh(container: Element) {
    if (this.frameId !== null) return;
    this.frameId = window.requestAnimationFrame(() => {
      this.refreshFolderStyles(container);
      this.frameId = null;
    });
  }

  private onClick = (evt: MouseEvent) => {
    const target = evt.target as HTMLElement;

    // File Explorer clicks
    const container = target.closest('.nav-files-container');
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

    const folderPath = path === '/' ? '' : path;
    const folder = this.plugin.app.vault.getAbstractFileByPath(
      folderPath || '/',
    );
    if (!(folder instanceof TFolder)) return;

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
    for (const leaf of this.fileExplorerLeaves) {
      const container = leaf.view.containerEl.querySelector(
        '.nav-files-container',
      );
      if (container) {
        this.scheduleRefresh(container);
      }
    }
  }

  private refreshFolderStyles(container: Element) {
    const fileElements = container.querySelectorAll('.nav-file');
    fileElements.forEach((el) => {
      const titleEl = el.querySelector(':scope > .nav-file-title');
      if (!titleEl) return;
      const path = titleEl.getAttribute('data-path');
      if (!path) return;

      const isNote = this.isFolderNotePath(path);
      const hasClass = el.classList.contains('fn-hidden-file');

      if (isNote && !hasClass) {
        el.classList.add('fn-hidden-file');
      } else if (!isNote && hasClass) {
        el.classList.remove('fn-hidden-file');
      }
    });

    const folderElements = container.querySelectorAll('.nav-folder');
    folderElements.forEach((el) => {
      const titleEl = el.querySelector(':scope > .nav-folder-title');
      if (!titleEl) return;

      const path = titleEl.getAttribute('data-path');
      if (path === null) return;
      const normalizedPath = path === '/' ? '' : path;

      const hasNote = this.getFolderNoteFile(normalizedPath) !== null;
      const hasClass = titleEl.classList.contains('has-folder-note');

      if (hasNote && !hasClass) {
        titleEl.classList.add('has-folder-note');
      } else if (!hasNote && hasClass) {
        titleEl.classList.remove('has-folder-note');
      }
    });
  }

  isFolderNotePath(filePath: string): boolean {
    const normalized = filePath.replace(/\/+$/, '');
    const parts = normalized.split('/');
    const fileNameWithExt = parts.pop() ?? '';
    const parentFolderName = parts.length > 0 ? parts[parts.length - 1] : '';

    const parsed = splitFileName(fileNameWithExt);
    if (!parsed) return false;

    return (
      parentFolderName !== '' &&
      parsed.baseName === parentFolderName &&
      SUPPORTED_EXTENSIONS.includes(parsed.ext)
    );
  }

  getFolderNoteFile(folderPath: string): TFile | null {
    const normalized = folderPath === '/' ? '' : folderPath;
    const folder = this.plugin.app.vault.getAbstractFileByPath(
      normalized || '/',
    );
    if (!(folder instanceof TFolder)) return null;

    const folderName = folder.name;
    if (!normalized || folderName === '/') return null;

    const prefix = normalized ? `${normalized}/` : '';
    for (const ext of SUPPORTED_EXTENSIONS) {
      const potentialPath = `${prefix}${folderName}.${ext}`;
      const file = this.plugin.app.vault.getAbstractFileByPath(potentialPath);
      if (file instanceof TFile) return file;
    }
    return null;
  }

  async createNewFolderNote(folderPath: string) {
    const normalized = folderPath === '/' ? '' : folderPath;
    const folder = this.plugin.app.vault.getAbstractFileByPath(
      normalized || '/',
    );
    if (!(folder instanceof TFolder)) return;

    const folderName = folder.name;
    if (!normalized || folderName === '/') return;

    const defaultExt =
      this.plugin.settings.folderNoteExtension ||
      SUPPORTED_EXTENSIONS[0] ||
      'base';
    const notePath = `${normalized}/${folderName}.${defaultExt}`;

    const newFile = await this.plugin.app.vault.create(notePath, '');
    await this.openFolderNote(newFile, false);
    this.triggerStyleRefresh();
  }

  async deleteFolderNote(noteFile: TFile) {
    try {
      await this.plugin.app.fileManager.trashFile(noteFile);
      this.triggerStyleRefresh();
    } catch (err) {
      new Notice(
        `폴더 노트를 삭제하는 데 실패했습니다: ${(err as Error).message}`,
      );
    }
  }

  async openFolderNote(file: TFile, newLeaf: boolean) {
    const leaf = this.plugin.app.workspace.getLeaf(newLeaf);
    await leaf.openFile(file);
  }
}
