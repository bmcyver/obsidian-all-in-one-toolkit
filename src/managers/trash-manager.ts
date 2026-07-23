import { ensureDirectoryExists } from '../utils/file';
import { TrashManagerModal } from '../ui/trash-modal';
import { BaseManager } from './base';
import { limitConcurrency } from '../utils/async';
import { createToggleSection } from '../utils/ui';

export interface TrashFile {
  path: string; // e.g. ".trash/folder/note.md"
  originalPath: string; // e.g. "folder/note.md"
  name: string; // e.g. "note.md"
  mtime: number; // last modified time
  size: number;
}

const TRASH_DIR = '.trash';

export class TrashManager extends BaseManager {
  protected isEnabled(): boolean {
    return this.plugin.settings.trashManagerEnabled;
  }

  onload() {
    this.plugin.addCommand({
      id: 'open-trash-manager',
      name: '휴지통 관리자 열기',
      checkCallback: (checking) => {
        if (!this.isEnabled()) return false;
        if (!checking) {
          new TrashManagerModal(this.plugin.app, this.plugin).open();
        }
        return true;
      },
    });
  }

  /**
   * Retrieves all files in the trash, sorted by modification time descending.
   */
  async getTrashFiles(): Promise<TrashFile[]> {
    const adapter = this.plugin.app.vault.adapter;
    let files: TrashFile[] = [];

    if (await adapter.exists(TRASH_DIR)) {
      files = await this.collectTrashFiles(TRASH_DIR);
    }

    files.sort((a, b) => b.mtime - a.mtime);
    return files;
  }

  private async collectTrashFiles(dir: string): Promise<TrashFile[]> {
    const adapter = this.plugin.app.vault.adapter;
    const list = await adapter.list(dir);
    const files: TrashFile[] = [];

    // Limit concurrency of stat() calls to 50 to avoid I/O bottlenecks
    const stats = await limitConcurrency(list.files, 50, (f) =>
      adapter.stat(f),
    );
    list.files.forEach((file, i) => {
      const stat = stats[i];
      const name = file.split('/').pop() || '';
      const originalPath = file.substring((TRASH_DIR + '/').length);
      files.push({
        path: file,
        originalPath,
        name,
        mtime: stat?.mtime || 0,
        size: stat?.size || 0,
      });
    });

    // Recursively collect folders in parallel (limited to 10 concurrently)
    const folderFilesResults = await limitConcurrency(
      list.folders,
      10,
      (folder) => this.collectTrashFiles(folder),
    );
    for (const folderFiles of folderFilesResults) {
      files.push(...folderFiles);
    }

    return files;
  }

  /**
   * Restores a trash file to its original path. Resolves conflicts by renaming.
   */
  async restoreItem(item: TrashFile): Promise<string> {
    const originalPath = item.originalPath;
    const uniquePath = await this.getUniqueRestorePath(originalPath);

    await ensureDirectoryExists(this.plugin.app, uniquePath);
    await this.plugin.app.vault.adapter.rename(item.path, uniquePath);
    return uniquePath;
  }

  /**
   * Permanently deletes an item from the trash.
   */
  async deleteItem(item: TrashFile): Promise<void> {
    await this.plugin.app.vault.adapter.remove(item.path);
  }

  /**
   * Empties the entire trash folder.
   */
  async emptyTrash(): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    if (await adapter.exists(TRASH_DIR)) {
      await adapter.rmdir(TRASH_DIR, true);
    }
  }

  private async getUniqueRestorePath(originalPath: string): Promise<string> {
    const adapter = this.plugin.app.vault.adapter;
    let path = originalPath;
    const lastDot = path.lastIndexOf('.');
    const extension = lastDot > 0 ? path.slice(lastDot + 1) : '';
    const baseWithoutExt = lastDot > 0 ? path.slice(0, lastDot) : path;

    let counter = 1;
    while (await adapter.exists(path)) {
      path = extension
        ? `${baseWithoutExt} (${counter}).${extension}`
        : `${baseWithoutExt} (${counter})`;
      counter++;
    }
    return path;
  }

  renderSettings(containerEl: HTMLElement) {
    createToggleSection(
      containerEl,
      '휴지통 관리자',
      this.plugin.settings.trashManagerEnabled,
      async (value) => {
        this.plugin.settings.trashManagerEnabled = value;
        await this.plugin.saveSettings();
      },
    );
  }
}
