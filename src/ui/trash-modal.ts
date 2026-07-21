import { App, Modal, Notice, setIcon } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';
import { TrashManager, type TrashFile } from '../managers/trash-manager';
import { formatBytes } from '../utils/file';

class TrashEmptyConfirmModal extends Modal {
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
  private trashManager: TrashManager;
  private items: TrashFile[] = [];
  private filteredItems: TrashFile[] = [];
  private searchQuery = '';
  private listEl!: HTMLElement;
  private statsTextEl!: HTMLElement;

  private currentPage = 1;
  private itemsPerPage = 30;

  constructor(app: App, plugin: AllInOneToolkitPlugin) {
    super(app);
    this.plugin = plugin;
    this.trashManager = plugin.getManager(TrashManager)!;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // Add custom class for styling
    this.modalEl.addClass('tk-trash-modal');

    contentEl.createEl('h2', { text: '휴지통 관리자' });

    // Stats bar
    const statsEl = contentEl.createDiv({ cls: 'tk-trash-stats-bar' });
    this.statsTextEl = statsEl.createSpan({ cls: 'tk-trash-stats-text' });

    // Action bar (Search & Empty Trash)
    const actionBar = contentEl.createDiv({ cls: 'tk-trash-action-bar' });

    const searchInput = actionBar.createEl('input', {
      type: 'text',
      placeholder: '파일 이름 또는 경로 검색...',
      cls: 'tk-trash-search',
    });

    let debounceTimeout: number;
    searchInput.addEventListener('input', (e) => {
      window.clearTimeout(debounceTimeout);
      debounceTimeout = window.setTimeout(() => {
        this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
        this.currentPage = 1;
        this.filterAndRender(true);
      }, 250);
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

    // Scroll event listener for infinite scrolling
    this.listEl.addEventListener('scroll', () => {
      const { scrollTop, scrollHeight, clientHeight } = this.listEl;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        this.loadMore();
      }
    });

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
      this.items = await this.trashManager.getTrashFiles();
      this.updateStats();
      this.currentPage = 1;
      this.filterAndRender(true);
    } catch (err) {
      this.listEl.empty();
      this.listEl.createDiv({
        text: `휴지통을 불러오는 데 실패했습니다: ${(err as Error).message}`,
        cls: 'tk-trash-error',
      });
    }
  }

  updateStats() {
    const totalCount = this.items.length;
    const totalBytes = this.items.reduce((sum, item) => sum + item.size, 0);
    this.statsTextEl.setText(
      `총 ${totalCount}개 파일 • 크기: ${formatBytes(totalBytes)}`,
    );
  }

  filterAndRender(reset = true) {
    if (reset) {
      this.listEl.empty();
    }

    this.filteredItems = this.items.filter((item) =>
      item.originalPath.toLowerCase().includes(this.searchQuery),
    );

    if (this.filteredItems.length === 0) {
      if (reset) {
        const emptyMsg = this.listEl.createDiv({ cls: 'tk-trash-empty-msg' });
        emptyMsg.createDiv({
          text: '휴지통이 비어 있습니다.',
          cls: 'tk-trash-empty-text',
        });
      }
      return;
    }

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = Math.min(
      this.currentPage * this.itemsPerPage,
      this.filteredItems.length,
    );

    for (let i = start; i < end; i++) {
      this.renderTrashItem(this.listEl, this.filteredItems[i]!);
    }
  }

  loadMore() {
    if (this.currentPage * this.itemsPerPage >= this.filteredItems.length) {
      return;
    }
    this.currentPage++;
    this.filterAndRender(false);
  }

  private renderTrashItem(containerEl: HTMLElement, item: TrashFile) {
    const itemEl = containerEl.createDiv({
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

    // Meta container (Path • Size) for clean mobile support
    const metaEl = infoEl.createDiv({
      cls: 'tk-trash-item-meta setting-item-description',
    });
    metaEl.createSpan({ text: item.originalPath, cls: 'tk-trash-item-path' });
    metaEl.createSpan({ text: ' • ', cls: 'tk-trash-item-divider' });
    metaEl.createSpan({
      text: formatBytes(item.size),
      cls: 'tk-trash-item-size',
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

  async restoreItem(item: TrashFile) {
    try {
      const uniquePath = await this.trashManager.restoreItem(item);
      new Notice(`복구 완료: ${uniquePath}`);
      this.items = this.items.filter((i) => i.path !== item.path);
      this.updateStats();
      this.currentPage = 1;
      this.filterAndRender(true);
    } catch (err) {
      new Notice(`복구 실패: ${(err as Error).message}`);
    }
  }

  async deleteItem(item: TrashFile) {
    try {
      await this.trashManager.deleteItem(item);
      new Notice(`영구 삭제 완료: ${item.name}`);
      this.items = this.items.filter((i) => i.path !== item.path);
      this.updateStats();
      this.currentPage = 1;
      this.filterAndRender(true);
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
      await this.trashManager.emptyTrash();
      new Notice('휴지통을 완전히 비웠습니다.');
      await this.loadItems();
    } catch (err) {
      new Notice(`휴지통 비우기 실패: ${(err as Error).message}`);
    }
  }
}
