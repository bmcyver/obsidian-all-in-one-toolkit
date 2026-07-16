import { App, Modal, Notice, setIcon } from 'obsidian';
import type AllInOneToolkitPlugin from './main';

interface TrashFile {
  path: string; // e.g. ".trash/folder/note.md"
  originalPath: string; // e.g. "folder/note.md"
  name: string; // e.g. "note.md"
  mtime: number; // last modified time
}

async function getTrashFiles(app: App): Promise<TrashFile[]> {
  const adapter = app.vault.adapter;
  const files: TrashFile[] = [];

  async function recurse(dir: string) {
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
      });
    }
    for (const folder of list.folders) {
      await recurse(folder);
    }
  }

  if (await adapter.exists('.trash')) {
    await recurse('.trash');
  }

  // Sort by modification time descending (most recently deleted/modified first)
  files.sort((a, b) => b.mtime - a.mtime);
  return files;
}

export class TrashManager {
  private plugin: AllInOneToolkitPlugin;

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
}

export class TrashEmptyConfirmModal extends Modal {
  private onConfirm: () => void;

  constructor(app: App, onConfirm: () => void) {
    super(app);
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: '휴지통 비우기 확인' });
    contentEl.createEl('p', {
      text: '정말 휴지통의 모든 파일과 폴더를 영구적으로 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
    });

    const buttonContainer = contentEl.createDiv({ cls: 'tk-confirm-buttons' });

    const confirmBtn = buttonContainer.createEl('button', {
      text: '비우기',
      cls: 'mod-warning',
    });
    confirmBtn.addEventListener('click', () => {
      this.onConfirm();
      this.close();
    });

    const cancelBtn = buttonContainer.createEl('button', {
      text: '취소',
    });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class TrashManagerModal extends Modal {
  private plugin: AllInOneToolkitPlugin;
  private items: TrashFile[] = [];
  private filteredItems: TrashFile[] = [];
  private searchQuery = '';
  private listEl!: HTMLElement;

  constructor(app: App, plugin: AllInOneToolkitPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // Add custom class for styling
    this.modalEl.addClass('tk-trash-modal');

    contentEl.createEl('h2', { text: '휴지통 관리자' });

    // Action bar (Search & Empty Trash)
    const actionBar = contentEl.createDiv({ cls: 'tk-trash-action-bar' });

    const searchInput = actionBar.createEl('input', {
      type: 'text',
      placeholder: '파일 이름 또는 경로 검색...',
      cls: 'tk-trash-search',
    });

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
      this.filterAndRender();
    });

    const emptyBtn = actionBar.createEl('button', {
      text: '전체 비우기',
      cls: 'mod-warning tk-trash-empty-btn',
    });

    emptyBtn.addEventListener('click', () => {
      this.confirmEmptyTrash();
    });

    // List container
    this.listEl = contentEl.createDiv({ cls: 'tk-trash-list' });

    // Load and render
    await this.loadItems();
  }

  async loadItems() {
    this.listEl.empty();
    this.listEl.createDiv({
      text: '로딩 중...',
      cls: 'tk-trash-loading',
    });

    try {
      this.items = await getTrashFiles(this.app);
      this.filterAndRender();
    } catch (err) {
      this.listEl.empty();
      this.listEl.createDiv({
        text: `휴지통을 불러오는 데 실패했습니다: ${(err as Error).message}`,
        cls: 'tk-trash-error',
      });
    }
  }

  filterAndRender() {
    this.listEl.empty();

    this.filteredItems = this.items.filter((item) =>
      item.originalPath.toLowerCase().includes(this.searchQuery),
    );

    if (this.filteredItems.length === 0) {
      const emptyMsg = this.listEl.createDiv({ cls: 'tk-trash-empty-msg' });
      emptyMsg.createDiv({
        text: '휴지통이 비어 있습니다.',
        cls: 'tk-trash-empty-text',
      });
      return;
    }

    for (const item of this.filteredItems) {
      const itemEl = this.listEl.createDiv({
        cls: 'tk-trash-item setting-item',
      });

      // Info container
      const infoEl = itemEl.createDiv({
        cls: 'tk-trash-item-info setting-item-info',
      });
      infoEl.createDiv({
        text: item.name,
        cls: 'tk-trash-item-name setting-item-name',
      });
      infoEl.createDiv({
        text: item.originalPath,
        cls: 'tk-trash-item-path setting-item-description',
      });

      // Actions container
      const controlEl = itemEl.createDiv({
        cls: 'tk-trash-item-controls setting-item-control',
      });

      // Restore button
      const restoreBtn = controlEl.createEl('button', {
        cls: 'tk-trash-btn mod-cta',
        title: '복구',
      });
      setIcon(restoreBtn, 'rotate-ccw');
      restoreBtn.addEventListener('click', () => {
        void this.restoreItem(item);
      });

      // Permanent Delete button
      const deleteBtn = controlEl.createEl('button', {
        cls: 'tk-trash-btn mod-warning',
        title: '영구 삭제',
      });
      setIcon(deleteBtn, 'trash-2');
      deleteBtn.addEventListener('click', () => {
        void this.deleteItem(item);
      });
    }
  }

  async restoreItem(item: TrashFile) {
    const originalPath = item.originalPath;
    const uniquePath = await this.getUniqueRestorePath(originalPath);

    try {
      await this.plugin.ensureDirectoryExists(uniquePath);
      await this.app.vault.adapter.rename(item.path, uniquePath);
      new Notice(`복구 완료: ${uniquePath}`);
      await this.loadItems();
    } catch (err) {
      new Notice(`복구 실패: ${(err as Error).message}`);
    }
  }

  async deleteItem(item: TrashFile) {
    try {
      await this.app.vault.adapter.remove(item.path);
      new Notice(`영구 삭제 완료: ${item.name}`);
      await this.loadItems();
    } catch (err) {
      new Notice(`삭제 실패: ${(err as Error).message}`);
    }
  }

  confirmEmptyTrash() {
    new TrashEmptyConfirmModal(this.app, () => {
      void this.emptyTrash();
    }).open();
  }

  async emptyTrash() {
    try {
      if (await this.app.vault.adapter.exists('.trash')) {
        await this.app.vault.adapter.rmdir('.trash', true);
      }
      new Notice('휴지통을 완전히 비웠습니다.');
      await this.loadItems();
    } catch (err) {
      new Notice(`휴지통 비우기 실패: ${(err as Error).message}`);
    }
  }

  private async getUniqueRestorePath(originalPath: string): Promise<string> {
    let path = originalPath;
    const lastDot = path.lastIndexOf('.');
    const extension = lastDot > 0 ? path.slice(lastDot + 1) : '';
    const baseWithoutExt = lastDot > 0 ? path.slice(0, lastDot) : path;

    let counter = 1;
    while (await this.app.vault.adapter.exists(path)) {
      path = extension
        ? `${baseWithoutExt} (${counter}).${extension}`
        : `${baseWithoutExt} (${counter})`;
      counter++;
    }
    return path;
  }
}
