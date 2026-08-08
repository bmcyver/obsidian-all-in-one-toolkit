import { Setting } from 'obsidian';

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

  new Setting(containerEl)
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

  detailEl = containerEl.createDiv();
  detailEl.toggleClass('is-hidden', !initialValue);

  return detailEl;
}
