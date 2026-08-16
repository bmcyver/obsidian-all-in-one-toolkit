import { App, FuzzySuggestModal, type FuzzyMatch } from 'obsidian';

export class EJSSelectModal extends FuzzySuggestModal<string> {
  private resolve: (value: string) => void;
  private submitted = false;
  private textItems: string[];
  private items: string[];

  constructor(
    app: App,
    placeholderText: string,
    textItems: string[],
    values: string[],
    resolve: (value: string) => void,
  ) {
    super(app);
    this.textItems = textItems;
    this.items =
      values && values.length === textItems.length ? values : textItems;
    this.resolve = resolve;
    this.setPlaceholder(placeholderText);
    this.emptyStateText = '일치하는 항목이 없습니다.';
  }

  getItems(): string[] {
    return this.items;
  }

  getItemText(item: string): string {
    const idx = this.items.indexOf(item);
    return this.textItems[idx] || item;
  }

  selectSuggestion(
    value: FuzzyMatch<string>,
    evt: MouseEvent | KeyboardEvent,
  ): void {
    this.submitted = true;
    this.close();
    this.onChooseSuggestion(value, evt);
  }

  onChooseItem(item: string): void {
    this.resolve(item);
  }

  onClose(): void {
    if (!this.submitted) {
      this.resolve('');
    }
  }
}
