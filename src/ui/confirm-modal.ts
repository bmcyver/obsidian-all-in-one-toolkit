import { App, Modal, ButtonComponent } from 'obsidian';

export class ConfirmModal extends Modal {
  private titleText: string;
  private messageText: string;
  private confirmText: string;
  private onConfirm: () => void;

  constructor(
    app: App,
    titleText: string,
    messageText: string,
    confirmText: string,
    onConfirm: () => void,
  ) {
    super(app);
    this.titleText = titleText;
    this.messageText = messageText;
    this.confirmText = confirmText;
    this.onConfirm = onConfirm;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle(this.titleText);

    contentEl.createEl('p', {
      text: this.messageText,
    });

    const buttonContainer = contentEl.createDiv({
      cls: 'modal-button-container',
    });

    new ButtonComponent(buttonContainer).setButtonText('취소').onClick(() => {
      this.close();
    });

    new ButtonComponent(buttonContainer)
      .setButtonText(this.confirmText)
      .setDestructive()
      .onClick(() => {
        this.close();
        this.onConfirm();
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}
