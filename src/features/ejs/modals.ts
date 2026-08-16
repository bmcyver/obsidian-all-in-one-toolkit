import {
  App,
  Modal,
  ButtonComponent,
  FuzzySuggestModal,
  type FuzzyMatch,
} from 'obsidian';

export class EJSSecurityModal extends Modal {
  private templatePath: string;
  private templateContent: string;
  private onDecision: (allowed: boolean) => void;
  private decisionMade = false;

  constructor(
    app: App,
    templatePath: string,
    templateContent: string,
    onDecision: (allowed: boolean) => void,
  ) {
    super(app);
    this.templatePath = templatePath;
    this.templateContent = templateContent;
    this.onDecision = onDecision;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    this.setTitle('EJS 템플릿 실행 승인');

    contentEl.createEl('p', {
      text: '템플릿이 처음 실행되거나 내용이 변경되었습니다. 아래 템플릿 내용을 확인한 후 신뢰할 수 있는 경우에만 허용하세요.',
    });

    const infoTable = contentEl.createDiv('ejs-security-info');

    const pathDiv = infoTable.createDiv();
    pathDiv.createEl('strong', { text: '템플릿 경로: ' });
    pathDiv.createSpan({ text: this.templatePath });

    const previewContainer = infoTable.createDiv({
      cls: 'ejs-security-preview-container',
    });
    previewContainer.createEl('strong', { text: '템플릿 내용 미리보기:' });
    const codeBlock = previewContainer.createEl('pre', {
      cls: 'ejs-security-code-preview',
    });
    codeBlock.createEl('code', { text: this.templateContent });

    const buttonContainer = contentEl.createDiv({
      cls: 'modal-button-container',
    });

    new ButtonComponent(buttonContainer).setButtonText('차단').onClick(() => {
      this.decisionMade = true;
      this.onDecision(false);
      this.close();
    });

    new ButtonComponent(buttonContainer)
      .setButtonText('허용 및 실행')
      .setDestructive()
      .onClick(() => {
        this.decisionMade = true;
        this.onDecision(true);
        this.close();
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.submitted()) {
      this.onDecision(false);
    }
  }

  private submitted(): boolean {
    return this.decisionMade;
  }
}

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
