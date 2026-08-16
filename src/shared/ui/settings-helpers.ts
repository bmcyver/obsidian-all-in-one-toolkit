import { setIcon, Setting } from 'obsidian';

/**
 * Shows an error message in the specified error element.
 */
export function showError(errorEl: HTMLElement, message: string): void {
  errorEl.textContent = message;
  errorEl.removeClass('is-hidden');
}

/**
 * Clears the error message from the specified error element.
 */
export function clearError(errorEl: HTMLElement): void {
  errorEl.addClass('is-hidden');
  errorEl.textContent = '';
}

/**
 * Adds an error container to the setting element.
 */
export function addErrorContainer(setting: Setting): HTMLElement {
  setting.settingEl.addClass('has-error-container');
  return setting.settingEl.createDiv({ cls: 'setting-item-error is-hidden' });
}

/**
 * Creates a standard toggle section with heading and detail container element.
 */
export function createToggleSection(
  containerEl: HTMLElement,
  title: string,
  initialValue: boolean,
  onToggle: (value: boolean) => Promise<void>,
): HTMLElement {
  let detailEl: HTMLElement;

  const setting = new Setting(containerEl)
    .setName(title)
    .setHeading()
    .addToggle((toggle) => {
      toggle.setValue(initialValue).onChange((value) => {
        void (async () => {
          await onToggle(value);
          if (detailEl) {
            detailEl.toggleClass('is-hidden', !value);
          }
        })();
      });
    });

  setting.settingEl.addClass('tk-feature-heading');

  detailEl = containerEl.createDiv({ cls: 'tk-feature-detail-container' });
  detailEl.toggleClass('is-hidden', !initialValue);

  return detailEl;
}

/**
 * Creates a foldable details section with summary and content container.
 */
export function createFoldableSection(
  containerEl: HTMLElement,
  title: string,
  badgeText?: string,
): {
  detailsEl: HTMLDetailsElement;
  summaryEl: HTMLElement;
  badgeEl: HTMLElement | null;
  contentEl: HTMLElement;
} {
  const detailsEl = containerEl.createEl('details', {
    cls: 'tk-fold-details',
  });

  const summaryEl = detailsEl.createEl('summary', {
    cls: 'tk-fold-summary',
  });

  const iconEl = summaryEl.createSpan({
    cls: 'tk-fold-icon',
  });
  setIcon(iconEl, 'chevron-right');

  summaryEl.createSpan({
    cls: 'tk-fold-title',
    text: title,
  });

  let badgeEl: HTMLElement | null = null;
  if (badgeText) {
    badgeEl = summaryEl.createSpan({
      cls: 'tk-fold-badge',
      text: badgeText,
    });
  }

  const contentEl = detailsEl.createDiv({
    cls: 'tk-fold-content',
  });

  return { detailsEl, summaryEl, badgeEl, contentEl };
}
