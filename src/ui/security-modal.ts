import { App, Modal, Setting } from 'obsidian';

export class EjsSecurityModal extends Modal {
  private templatePath: string;
  private hash: string;
  private onDecision: (allowed: boolean) => void;
  private decisionMade = false;

  constructor(
    app: App,
    templatePath: string,
    hash: string,
    onDecision: (allowed: boolean) => void,
  ) {
    super(app);
    this.templatePath = templatePath;
    this.hash = hash;
    this.onDecision = onDecision;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', {
      text: 'EJS 템플릿 실행 승인 필요 (Security Warning)',
      cls: 'mod-warning',
    });

    contentEl.createEl('p', {
      text: '지정된 EJS 템플릿이 처음 실행되거나 파일 내용이 변경되었습니다. EJS 템플릿은 샌드박스 없이 임의의 JavaScript 코드를 실행할 수 있으므로, 신뢰할 수 있는 템플릿만 실행해 주세요.',
    });

    const infoTable = contentEl.createDiv('ejs-security-info');

    const pathDiv = infoTable.createDiv();
    pathDiv.createEl('strong', { text: '템플릿 경로: ' });
    pathDiv.createSpan({ text: this.templatePath });

    const hashDiv = infoTable.createDiv('ejs-security-info-hash');
    hashDiv.createEl('strong', { text: 'SHA-256 해시: ' });
    hashDiv.createEl('code', { text: this.hash });

    new Setting(contentEl)
      .addButton((btn) => {
        btn
          .setButtonText('이 템플릿 허용 및 실행 (Allow & Run)')
          .setCta()
          .onClick(() => {
            this.decisionMade = true;
            this.onDecision(true);
            this.close();
          });
      })
      .addButton((btn) => {
        btn.setButtonText('차단 (Block)').onClick(() => {
          this.decisionMade = true;
          this.onDecision(false);
          this.close();
        });
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.decisionMade) {
      this.onDecision(false);
    }
  }
}
