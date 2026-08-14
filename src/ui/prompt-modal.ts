import {
  App,
  ButtonComponent,
  Modal,
  Platform,
  TextAreaComponent,
  TextComponent,
} from 'obsidian';

export class PromptModal extends Modal {
  private resolve: (value: string) => void;
  private submitted = false;
  private value: string;
  private promptText: string;
  private defaultValue: string;
  private multiLine: boolean;
  private selectDefaultValue: boolean;

  constructor(
    app: App,
    promptText: string,
    defaultValue = '',
    resolve: (value: string) => void = () => {},
    multiLine = false,
    selectDefaultValue = true,
  ) {
    super(app);
    this.promptText = promptText;
    this.defaultValue = defaultValue ?? '';
    this.value = this.defaultValue;
    this.resolve = resolve;
    this.multiLine = multiLine;
    this.selectDefaultValue = selectDefaultValue;
  }

  onOpen(): void {
    this.titleEl.setText(this.promptText);
    this.createForm();
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.submitted) {
      this.resolve(this.defaultValue);
    }
  }

  private createForm(): void {
    const div = this.contentEl.createDiv({ cls: 'tk-prompt-container' });
    let textInput: TextAreaComponent | TextComponent;
    if (this.multiLine) {
      textInput = new TextAreaComponent(div);
    } else {
      textInput = new TextComponent(div);
    }

    const buttonDiv = this.contentEl.createDiv({
      cls: 'modal-button-container',
    });

    const cancelButton = new ButtonComponent(buttonDiv);
    cancelButton.setButtonText('취소').onClick(() => {
      this.close();
    });

    const submitButton = new ButtonComponent(buttonDiv);
    submitButton.setCta();
    submitButton.setButtonText('확인').onClick((evt: Event) => {
      this.resolveAndClose(evt);
    });

    this.value = this.defaultValue ?? '';
    textInput.inputEl.addClass('tk-prompt-input');
    textInput.setValue(this.value);
    textInput.onChange((value) => (this.value = value));
    textInput.inputEl.focus();
    if (this.selectDefaultValue) {
      textInput.inputEl.select();
    }
    textInput.inputEl.addEventListener('keydown', (evt: Event) => {
      if (evt instanceof KeyboardEvent) {
        this.enterCallback(evt);
      }
    });
  }

  private enterCallback(evt: KeyboardEvent) {
    if (evt.isComposing) return;

    if (this.multiLine) {
      if (Platform.isDesktop && evt.key === 'Enter' && !evt.shiftKey) {
        this.resolveAndClose(evt);
      }
    } else {
      if (evt.key === 'Enter') {
        this.resolveAndClose(evt);
      }
    }
  }

  private resolveAndClose(evt: Event | KeyboardEvent) {
    this.submitted = true;
    evt.preventDefault();
    this.resolve(this.value);
    this.close();
  }

  async openAndGetValue(resolve: (value: string) => void): Promise<void> {
    this.resolve = resolve;
    this.open();
  }
}

/**
 * Backward compatibility alias for EjsPromptModal
 */
export const EjsPromptModal = PromptModal;
export type EjsPromptModal = PromptModal;
