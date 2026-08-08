import {
  App,
  Modal,
  Editor,
  setIcon,
  SearchComponent,
  ButtonComponent,
} from 'obsidian';
import type { LintError } from 'markdownlint';
import { getRuleDocUrl } from '../constants/markdownlint-rules';

export class MarkdownlintResultModal extends Modal {
  private editor: Editor;
  private issues: LintError[];
  private onFixAll?: () => void;
  private searchQuery = '';

  constructor(
    app: App,
    editor: Editor,
    issues: LintError[],
    onFixAll?: () => void,
  ) {
    super(app);
    this.editor = editor;
    this.issues = issues;
    this.onFixAll = onFixAll;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.modalEl.addClass('tk-markdownlint-result-modal');

    this.setTitle('Markdown Lint 검사 결과');

    const fixableCount = this.issues.filter((i) => Boolean(i.fixInfo)).length;

    // Stats Bar
    const statsBar = contentEl.createDiv({
      cls: 'tk-markdownlint-stats-bar',
    });
    const fixableText =
      fixableCount > 0 ? ` • 자동 수정 가능 ${fixableCount}개` : '';
    statsBar.createSpan({
      cls: 'tk-markdownlint-stats-text',
      text: `총 ${this.issues.length}개 위반${fixableText}`,
    });

    // Action & Search Bar
    const actionBar = contentEl.createDiv({
      cls: 'tk-markdownlint-modal-action-bar',
    });

    let debounceTimeout: number;
    new SearchComponent(actionBar)
      .setPlaceholder('규칙 ID, 내용, 라인 검색...')
      .onChange((value) => {
        window.clearTimeout(debounceTimeout);
        debounceTimeout = window.setTimeout(() => {
          this.searchQuery = value.toLowerCase().trim();
          this.renderList(listContainer);
        }, 200);
      });

    if (fixableCount > 0 && this.onFixAll) {
      new ButtonComponent(actionBar)
        .setButtonText('모두 자동 수정')
        .setCta()
        .onClick(() => {
          this.onFixAll?.();
          this.close();
        });
    }

    const listContainer = contentEl.createDiv({
      cls: 'tk-markdownlint-result-list',
    });

    this.renderList(listContainer);
  }

  private renderList(containerEl: HTMLElement) {
    containerEl.empty();

    const filtered = this.issues.filter((issue) => {
      if (!this.searchQuery) return true;
      const ruleId = (issue.ruleNames[0] || '').toLowerCase();
      const ruleName = (issue.ruleNames[1] || '').toLowerCase();
      const desc = (issue.ruleDescription || '').toLowerCase();
      const detail = (issue.errorDetail || '').toLowerCase();
      const lineStr = String(issue.lineNumber);
      return (
        ruleId.includes(this.searchQuery) ||
        ruleName.includes(this.searchQuery) ||
        desc.includes(this.searchQuery) ||
        detail.includes(this.searchQuery) ||
        lineStr.includes(this.searchQuery)
      );
    });

    if (filtered.length === 0) {
      const emptyDiv = containerEl.createDiv({
        cls: 'tk-markdownlint-empty-msg',
      });
      emptyDiv.createSpan({
        text: '검색 결과와 일치하는 위반 항목이 없습니다.',
      });
      return;
    }

    const fragment = createFragment();

    for (const issue of filtered) {
      const lineNum = issue.lineNumber;
      const ruleId = issue.ruleNames[0] || 'MD000';
      const ruleName = issue.ruleNames[1] ? ` (${issue.ruleNames[1]})` : '';
      const desc = issue.ruleDescription || issue.errorDetail || '';
      const detail =
        issue.errorDetail && issue.errorDetail !== desc
          ? ` - ${issue.errorDetail}`
          : '';
      const isFixable = Boolean(issue.fixInfo);

      const itemEl = createDiv({
        cls: `tk-markdownlint-result-item ${isFixable ? 'is-fixable' : ''}`,
      });

      const itemHeaderEl = itemEl.createDiv({
        cls: 'tk-markdownlint-result-item-header',
      });

      // Line navigation button
      const lineBtn = itemHeaderEl.createEl('button', {
        cls: 'tk-markdownlint-line-btn',
        title: '해당 줄로 이동',
      });
      setIcon(lineBtn, 'arrow-right');
      lineBtn.createSpan({ text: `L${lineNum}` });

      lineBtn.addEventListener('click', () => {
        const targetLine = Math.max(0, lineNum - 1);
        const maxLine = Math.max(0, this.editor.lineCount() - 1);
        const actualLine = Math.min(targetLine, maxLine);
        this.editor.setCursor({ line: actualLine, ch: 0 });
        this.editor.focus();
        this.close();
      });

      // Rule ID Link Badge & Name
      const ruleLink = itemHeaderEl.createEl('a', {
        cls: 'tk-markdownlint-rule-badge',
        text: ruleId,
        href: getRuleDocUrl(ruleId),
      });
      ruleLink.target = '_blank';
      ruleLink.rel = 'noopener noreferrer';

      if (ruleName) {
        itemHeaderEl.createSpan({
          cls: 'tk-markdownlint-rule-name',
          text: ruleName,
        });
      }

      if (isFixable) {
        itemHeaderEl.createSpan({
          cls: 'tk-markdownlint-fixable-tag',
          text: '자동 수정 가능',
        });
      }

      const bodyEl = itemEl.createDiv({
        cls: 'tk-markdownlint-result-item-body',
      });
      bodyEl.createDiv({
        cls: 'tk-markdownlint-result-desc',
        text: `${desc}${detail}`,
      });

      if (issue.errorContext) {
        bodyEl.createEl('code', {
          cls: 'tk-markdownlint-result-context',
          text: issue.errorContext.trim(),
        });
      }

      fragment.appendChild(itemEl);
    }

    containerEl.appendChild(fragment);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
