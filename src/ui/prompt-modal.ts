import { App, Modal, Setting, ButtonComponent } from 'obsidian';

export class EjsPromptModal extends Modal {
  private message: string;
  private defaultValue: string;
  private onSubmit: (value: string) => void;
  private submitted = false;
  private value = '';

  constructor(
    app: App,
    message: string,
    defaultValue: string,
    onSubmit: (value: string) => void,
  ) {
    super(app);
    this.message = message;
    this.defaultValue = defaultValue;
    this.value = defaultValue;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    this.setTitle(this.message);

    new Setting(contentEl).addText((text) => {
      text.setValue(this.defaultValue);

      // Auto focus the input field
      window.setTimeout(() => {
        text.inputEl.focus();
        text.inputEl.select();
      }, 50);

      text.onChange((val) => {
        this.value = val;
      });

      // Submit on Enter key
      text.inputEl.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          this.submit();
        }
      });
    });

    const buttonContainer = contentEl.createDiv({
      cls: 'modal-button-container',
    });

    new ButtonComponent(buttonContainer).setButtonText('취소').onClick(() => {
      this.close();
    });

    new ButtonComponent(buttonContainer)
      .setButtonText('확인')
      .setCta()
      .onClick(() => {
        this.submit();
      });
  }

  private submit() {
    this.submitted = true;
    this.onSubmit(this.value);
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.submitted) {
      this.onSubmit(this.defaultValue);
    }
  }
}
