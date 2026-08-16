import { ensureDirectoryExists } from '../../shared/utils/file';
import { TrashManagerModal } from './modal';
import { Feature } from '../../shared/types';
import { createToggleSection } from '../../shared/ui/settings-helpers';

export interface TrashFile {
  path: string; // e.g. ".trash/folder/note.md"
  originalPath: string; // e.g. "folder/note.md"
  name: string; // e.g. "note.md"
  mtime: number; // last modified time
  size: number;
}

const TRASH_DIR = '.trash';
const TRASH_PREFIX_LEN = TRASH_DIR.length + 1; // '.trash/'.length

export class TrashManagerFeature extends Feature {
  private isEnabled(): boolean {
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

    const stats = await Promise.all(
      list.files.map((f) => adapter.stat(f).catch(() => null)),
    );

    for (let i = 0; i < list.files.length; i++) {
      const file = list.files[i]!;
      const stat = stats[i];
      const lastSlash = file.lastIndexOf('/');
      const name = lastSlash >= 0 ? file.slice(lastSlash + 1) : file;
      const originalPath = file.slice(TRASH_PREFIX_LEN);

      files.push({
        path: file,
        originalPath,
        name,
        mtime: stat?.mtime || 0,
        size: stat?.size || 0,
      });
    }

    if (list.folders.length > 0) {
      const folderFilesResults = await Promise.all(
        list.folders.map((folder) => this.collectTrashFiles(folder)),
      );
      for (const folderFiles of folderFilesResults) {
        for (const file of folderFiles) {
          files.push(file);
        }
      }
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
    const lastSlash = originalPath.lastIndexOf('/');
    const dir = lastSlash >= 0 ? originalPath.slice(0, lastSlash + 1) : '';
    const filename =
      lastSlash >= 0 ? originalPath.slice(lastSlash + 1) : originalPath;

    const lastDot = filename.lastIndexOf('.');
    const extension = lastDot > 0 ? filename.slice(lastDot + 1) : '';
    const nameWithoutExt = lastDot > 0 ? filename.slice(0, lastDot) : filename;

    let counter = 1;
    let path = originalPath;
    while (await adapter.exists(path)) {
      const candidateName = extension
        ? `${nameWithoutExt} (${counter}).${extension}`
        : `${nameWithoutExt} (${counter})`;
      path = `${dir}${candidateName}`;
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
