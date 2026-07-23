import { Setting } from 'obsidian';

/**
 * Shows an error message in the specified error element by setting its text
 * and removing the 'is-hidden' class.
 */
export function showError(errorEl: HTMLElement, message: string): void {
  errorEl.textContent = message;
  errorEl.removeClass('is-hidden');
}

/**
 * Clears the error message from the specified error element by adding the
 * 'is-hidden' class and emptying its text.
 */
export function clearError(errorEl: HTMLElement): void {
  errorEl.addClass('is-hidden');
  errorEl.textContent = '';
}

/**
 * Adds an error class to the setting element and creates a hidden error container div.
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
  const detailEl = containerEl.createDiv();
  detailEl.style.display = initialValue ? '' : 'none';

  new Setting(containerEl)
    .setName(title)
    .setHeading()
    .addToggle((toggle) => {
      toggle.setValue(initialValue).onChange((value) => {
        void (async () => {
          await onToggle(value);
          detailEl.style.display = value ? '' : 'none';
        })();
      });
    });

  return detailEl;
}
