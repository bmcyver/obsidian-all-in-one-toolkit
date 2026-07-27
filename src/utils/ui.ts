import { Setting, TextComponent } from 'obsidian';

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

export interface ValidatedTextSettingOptions {
  name: string;
  desc?: string;
  initialValue: string;
  placeholder?: string;
  inputType?: string;
  min?: string;
  max?: string;
  validate?: (value: string) => string | null;
  onChange: (value: string) => Promise<void> | void;
  onSetupText?: (text: TextComponent) => void;
}

/**
 * Creates a text setting with optional input type, validation, and error display container.
 */
export function addValidatedTextSetting(
  containerEl: HTMLElement,
  options: ValidatedTextSettingOptions,
): Setting {
  const setting = new Setting(containerEl).setName(options.name);
  if (options.desc) {
    setting.setDesc(options.desc);
  }

  const errorEl = addErrorContainer(setting);

  setting.addText((text) => {
    if (options.placeholder) text.setPlaceholder(options.placeholder);
    if (options.inputType) text.inputEl.type = options.inputType;
    if (options.min !== undefined) text.inputEl.min = options.min;
    if (options.max !== undefined) text.inputEl.max = options.max;
    text.setValue(options.initialValue);

    if (options.onSetupText) {
      options.onSetupText(text);
    }

    text.onChange((value) => {
      void (async () => {
        if (options.validate) {
          const errorMsg = options.validate(value);
          if (errorMsg) {
            showError(errorEl, errorMsg);
            return;
          }
        }
        clearError(errorEl);
        await options.onChange(value);
      })();
    });
  });

  return setting;
}

export interface DropdownSettingOptions {
  name: string;
  desc?: string;
  initialValue: string;
  options: Record<string, string>;
  onChange: (value: string) => Promise<void> | void;
}

/**
 * Creates a dropdown setting section.
 */
export function addDropdownSetting(
  containerEl: HTMLElement,
  options: DropdownSettingOptions,
): Setting {
  const setting = new Setting(containerEl).setName(options.name);
  if (options.desc) {
    setting.setDesc(options.desc);
  }

  setting.addDropdown((dropdown) => {
    dropdown.addOptions(options.options);
    dropdown.setValue(options.initialValue);
    dropdown.onChange((value) => {
      void (async () => {
        await options.onChange(value);
      })();
    });
  });

  return setting;
}

export interface ButtonSettingOptions {
  name: string;
  desc?: string;
  buttonText: string;
  warning?: boolean;
  onClick: () => Promise<void> | void;
}

/**
 * Creates a setting section with an action button.
 */
export function addButtonSetting(
  containerEl: HTMLElement,
  options: ButtonSettingOptions,
): Setting {
  const setting = new Setting(containerEl).setName(options.name);
  if (options.desc) {
    setting.setDesc(options.desc);
  }

  setting.addButton((button) => {
    button.setButtonText(options.buttonText).onClick(() => {
      void (async () => {
        await options.onClick();
      })();
    });
    if (options.warning) {
      button.buttonEl.addClass('mod-warning');
    }
  });

  return setting;
}
