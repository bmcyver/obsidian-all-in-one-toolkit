import {
  App,
  Modal,
  Notice,
  SearchComponent,
  ButtonComponent,
  ExtraButtonComponent,
} from 'obsidian';
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
    contentEl.empty();

    this.setTitle('휴지통 비우기');

    contentEl.createEl('p', {
      text: '휴지통의 모든 항목을 영구 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
    });

    const buttonContainer = contentEl.createDiv({
      cls: 'modal-button-container',
    });

    new ButtonComponent(buttonContainer)
      .setButtonText('취소')
      .onClick(() => this.close());

    new ButtonComponent(buttonContainer)
      .setButtonText('비우기')
      .setDestructive()
      .setCta()
      .onClick(() => {
        this.onConfirm();
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

    this.setTitle('휴지통 관리자');
    this.modalEl.addClass('tk-trash-modal');

    // Stats bar
    const statsEl = contentEl.createDiv({ cls: 'tk-trash-stats-bar' });
    this.statsTextEl = statsEl.createSpan({ cls: 'tk-trash-stats-text' });

    // Action bar (Search & Empty Trash)
    const actionBar = contentEl.createDiv({ cls: 'tk-trash-action-bar' });

    let debounceTimeout: number;
    new SearchComponent(actionBar)
      .setPlaceholder('검색...')
      .onChange((value) => {
        window.clearTimeout(debounceTimeout);
        debounceTimeout = window.setTimeout(() => {
          this.searchQuery = value.toLowerCase();
          this.currentPage = 1;
          this.filterAndRender(true);
        }, 250);
      });

    new ButtonComponent(actionBar)
      .setButtonText('휴지통 비우기')
      .setDestructive()
      .setCta()
      .onClick(() => this.confirmEmptyTrash());

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
        text: `휴지통 로딩 실패: ${(err as Error).message}`,
        cls: 'tk-trash-error',
      });
    }
  }

  updateStats() {
    const totalCount = this.items.length;
    const totalBytes = this.items.reduce((sum, item) => sum + item.size, 0);
    this.statsTextEl.setText(`총 ${totalCount}개 • ${formatBytes(totalBytes)}`);
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
      const item = this.filteredItems[i];
      if (item) {
        this.renderTrashItem(this.listEl, item);
      }
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
      cls: 'tk-trash-item',
    });

    // Info container
    const infoEl = itemEl.createDiv({
      cls: 'tk-trash-item-info',
    });
    infoEl.createDiv({
      text: item.name,
      cls: 'tk-trash-item-name',
    });

    // Meta container (Path • Size) for clean mobile support
    const metaEl = infoEl.createDiv({
      cls: 'tk-trash-item-meta',
    });
    metaEl.createSpan({ text: item.originalPath, cls: 'tk-trash-item-path' });
    metaEl.createSpan({ text: ' • ', cls: 'tk-trash-item-divider' });
    metaEl.createSpan({
      text: formatBytes(item.size),
      cls: 'tk-trash-item-size',
    });

    // Actions container
    const controlEl = itemEl.createDiv({
      cls: 'tk-trash-item-controls',
    });

    // Restore button
    new ExtraButtonComponent(controlEl)
      .setIcon('rotate-ccw')
      .setTooltip('복구')
      .onClick(() => {
        void this.restoreItem(item);
      });

    // Permanent Delete button
    new ExtraButtonComponent(controlEl)
      .setIcon('trash-2')
      .setTooltip('영구 삭제')
      .onClick(() => {
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
      new Notice('휴지통을 비웠습니다.');
      await this.loadItems();
    } catch (err) {
      new Notice(`휴지통 비우기 실패: ${(err as Error).message}`);
    }
  }
}
