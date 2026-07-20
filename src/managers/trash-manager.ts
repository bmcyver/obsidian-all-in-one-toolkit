import type AllInOneToolkitPlugin from '../main';
import { ensureDirectoryExists } from '../utils/file';
import { TrashManagerModal } from '../ui/trash-modal';
import { BaseManager } from './base';

export interface TrashFile {
  path: string; // e.g. ".trash/folder/note.md"
  originalPath: string; // e.g. "folder/note.md"
  name: string; // e.g. "note.md"
  mtime: number; // last modified time
  size: number;
}

export class TrashManager implements BaseManager {
  plugin: AllInOneToolkitPlugin;

  constructor(plugin: AllInOneToolkitPlugin) {
    this.plugin = plugin;
  }

  onload() {
    this.plugin.addCommand({
      id: 'open-trash-manager',
      name: '휴지통 관리자 열기',
      callback: () => {
        new TrashManagerModal(this.plugin.app, this.plugin).open();
      },
    });
  }

  onunload() {
    // Lifecycle cleanup placeholder
  }

  /**
   * Retrieves all files in the trash, sorted by modification time descending.
   */
  async getTrashFiles(): Promise<TrashFile[]> {
    const adapter = this.plugin.app.vault.adapter;
    const files: TrashFile[] = [];

    const recurse = async (dir: string) => {
      const list = await adapter.list(dir);
      for (const file of list.files) {
        const stat = await adapter.stat(file);
        const name = file.split('/').pop() || '';
        const originalPath = file.substring('.trash/'.length);
        files.push({
          path: file,
          originalPath,
          name,
          mtime: stat?.mtime || 0,
          size: stat?.size || 0,
        });
      }
      for (const folder of list.folders) {
        await recurse(folder);
      }
    };

    if (await adapter.exists('.trash')) {
      await recurse('.trash');
    }

    files.sort((a, b) => b.mtime - a.mtime);
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
    if (await adapter.exists('.trash')) {
      await adapter.rmdir('.trash', true);
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
    // No settings for TrashManager
  }
}
