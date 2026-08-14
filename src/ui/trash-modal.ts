import {
  App,
  Modal,
  Notice,
  SearchComponent,
  ButtonComponent,
  ExtraButtonComponent,
  ConfirmationModal,
} from 'obsidian';
import type AllInOneToolkitPlugin from '../main';
import { TrashManager, type TrashFile } from '../managers/trash-manager';
import { formatBytes } from '../utils/file';

export class TrashManagerModal extends Modal {
  private plugin: AllInOneToolkitPlugin;
  private trashManager: TrashManager;
  private items: TrashFile[] = [];
  private filteredItems: TrashFile[] = [];
  private searchQuery = '';
  private listEl!: HTMLElement;
  private paginationEl!: HTMLElement;
  private statsEl!: HTMLElement;
  private currentPage = 1;
  private readonly pageSize = 20;

  constructor(app: App, plugin: AllInOneToolkitPlugin) {
    super(app);
    this.plugin = plugin;
    const manager = plugin.getManager(TrashManager);
    if (!manager) {
      throw new Error('TrashManager is not loaded');
    }
    this.trashManager = manager;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.modalEl.addClass('tk-trash-modal');

    this.setTitle('휴지통 관리자');

    const actionBar = contentEl.createDiv({
      cls: 'tk-trash-action-bar',
    });

    const searchComponent = new SearchComponent(actionBar);
    searchComponent.setPlaceholder('휴지통 파일 검색...');
    searchComponent.onChange((value) => {
      this.searchQuery = value.toLowerCase();
      this.currentPage = 1;
      this.filterAndRender();
    });

    const emptyBtn = new ButtonComponent(actionBar);
    emptyBtn.setButtonText('휴지통 비우기');
    emptyBtn.setDestructive();
    emptyBtn.onClick(() => this.confirmEmptyTrash());

    this.statsEl = contentEl.createDiv({
      cls: 'tk-trash-stats-bar',
    });

    this.listEl = contentEl.createDiv({
      cls: 'tk-trash-list',
    });

    this.paginationEl = contentEl.createDiv({
      cls: 'tk-trash-pagination',
    });

    void this.loadItems();
  }

  async loadItems() {
    this.listEl.empty();
    this.listEl.createDiv({
      text: '휴지통 로딩 중...',
      cls: 'tk-trash-empty-msg',
    });

    try {
      this.items = await this.trashManager.getTrashFiles();
      this.updateStats();
      this.filterAndRender(true);
    } catch (err) {
      this.listEl.empty();
      this.listEl.createDiv({
        text: `휴지통을 불러오는 중 오류가 발생했습니다: ${(err as Error).message}`,
        cls: 'tk-trash-error',
      });
    }
  }

  updateStats() {
    const count = this.items.length;
    const totalSize = this.items.reduce((acc, cur) => acc + cur.size, 0);
    this.statsEl.setText(
      `총 ${count}개 항목 (${formatBytes(totalSize)}) 이 휴지통에 보관되어 있습니다.`,
    );
  }

  filterAndRender(forceResetPage = false) {
    if (forceResetPage) {
      this.currentPage = 1;
    }

    if (!this.searchQuery) {
      this.filteredItems = [...this.items];
    } else {
      this.filteredItems = this.items.filter(
        (item) =>
          item.name.toLowerCase().includes(this.searchQuery) ||
          item.originalPath.toLowerCase().includes(this.searchQuery),
      );
    }

    this.renderList();
    this.renderPagination();
  }

  renderList() {
    this.listEl.empty();

    if (this.filteredItems.length === 0) {
      this.listEl.createDiv({
        text: '휴지통이 비어 있거나 검색 결과가 없습니다.',
        cls: 'tk-trash-empty-msg',
      });
      return;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const pageItems = this.filteredItems.slice(
      startIndex,
      startIndex + this.pageSize,
    );

    for (const item of pageItems) {
      this.renderItemRow(item);
    }
  }

  renderItemRow(item: TrashFile) {
    const row = this.listEl.createDiv({ cls: 'tk-trash-item' });

    const infoContainer = row.createDiv({ cls: 'tk-trash-item-info' });

    const nameEl = infoContainer.createDiv({ cls: 'tk-trash-item-name' });
    nameEl.setText(item.name);
    nameEl.setAttribute('title', item.path);

    const metaEl = infoContainer.createDiv({ cls: 'tk-trash-item-meta' });
    const pathEl = metaEl.createSpan({ cls: 'tk-trash-item-path' });
    pathEl.setText(item.originalPath);

    metaEl.createSpan({ cls: 'tk-trash-item-divider', text: '•' });

    const sizeEl = metaEl.createSpan({ cls: 'tk-trash-item-size' });
    sizeEl.setText(formatBytes(item.size));

    if (item.mtime) {
      metaEl.createSpan({ cls: 'tk-trash-item-divider', text: '•' });
      const dateEl = metaEl.createSpan({ cls: 'tk-trash-item-date' });
      dateEl.setText(new Date(item.mtime).toLocaleString());
    }

    const actionsContainer = row.createDiv({
      cls: 'tk-trash-item-controls',
    });

    const restoreBtn = new ExtraButtonComponent(actionsContainer);
    restoreBtn.setIcon('undo-2');
    restoreBtn.setTooltip('복원');
    restoreBtn.onClick(() => void this.restoreItem(item));

    const deleteBtn = new ExtraButtonComponent(actionsContainer);
    deleteBtn.setIcon('trash-2');
    deleteBtn.setTooltip('영구 삭제');
    deleteBtn.onClick(() => void this.deleteItem(item));
  }

  renderPagination() {
    this.paginationEl.empty();

    const totalPages = Math.ceil(this.filteredItems.length / this.pageSize);
    if (totalPages <= 1) {
      return;
    }

    const prevBtn = new ButtonComponent(this.paginationEl);
    prevBtn.setButtonText('이전');
    prevBtn.setDisabled(this.currentPage <= 1);
    prevBtn.onClick(() => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderList();
        this.renderPagination();
      }
    });

    const pageInfo = this.paginationEl.createSpan({
      cls: 'tk-trash-page-info',
    });
    pageInfo.setText(` ${this.currentPage} / ${totalPages} `);

    const nextBtn = new ButtonComponent(this.paginationEl);
    nextBtn.setButtonText('다음');
    nextBtn.setDisabled(this.currentPage >= totalPages);
    nextBtn.onClick(() => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderList();
        this.renderPagination();
      }
    });
  }

  async restoreItem(item: TrashFile) {
    try {
      await this.trashManager.restoreItem(item);
      new Notice(`복원 완료: ${item.name}`);
      this.items = this.items.filter((i) => i.path !== item.path);
      this.updateStats();
      this.filterAndRender();
    } catch (err) {
      new Notice(`복원 실패: ${(err as Error).message}`);
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
      new Notice(`영구 삭제 실패: ${(err as Error).message}`);
    }
  }

  confirmEmptyTrash() {
    new ConfirmationModal(this.app)
      .setTitle('휴지통 비우기')
      .setContent(
        '휴지통의 모든 항목을 영구 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.',
      )
      .addButton((b) =>
        b
          .setButtonText('비우기')
          .setDestructive()
          .setCta()
          .onClick(() => {
            void this.emptyTrash();
          }),
      )
      .addButton((b) => b.setButtonText('취소').onClick(() => {}))
      .open();
  }

  async emptyTrash() {
    try {
      await this.trashManager.emptyTrash();
      new Notice('휴지통 비우기 완료');
      await this.loadItems();
    } catch (err) {
      new Notice(`휴지통 비우기 실패: ${(err as Error).message}`);
    }
  }
}
