import { App, SuggestModal } from 'obsidian';

export class EjsSelectModal extends SuggestModal<string> {
  private placeholderText: string;
  private items: string[];
  private values: string[];
  private onSelect: (value: string) => void;
  private submitted = false;

  constructor(
    app: App,
    placeholderText: string,
    items: string[],
    values: string[],
    onSelect: (value: string) => void,
  ) {
    super(app);
    this.placeholderText = placeholderText;
    this.items = items;
    this.values = values;
    this.onSelect = onSelect;
    this.setPlaceholder(this.placeholderText);
  }

  getSuggestions(query: string): string[] {
    return this.items.filter((item) =>
      item.toLowerCase().includes(query.toLowerCase()),
    );
  }

  renderSuggestion(value: string, el: HTMLElement) {
    el.setText(value);
  }

  onChooseSuggestion(item: string, evt: MouseEvent | KeyboardEvent) {
    this.submitted = true;
    const idx = this.items.indexOf(item);
    const selectedValue = this.values[idx] ?? item;
    this.onSelect(selectedValue);
  }

  onClose() {
    super.onClose();
    if (!this.submitted) {
      // If closed without selection, resolve with an empty string
      this.onSelect('');
    }
  }
}
