import AllInOneToolkitPlugin from '../main';

export abstract class BaseManager {
  private loaded = false;

  constructor(protected readonly plugin: AllInOneToolkitPlugin) {}

  abstract onload(): void;

  onunload(): void {
    // Optional cleanup logic
  }

  renderSettings(containerEl: HTMLElement): void {
    // Optional settings UI rendering logic
  }

  protected isEnabled(): boolean {
    return true; // Default to always enabled
  }

  enable(): void {
    if (this.loaded) return;
    if (this.isEnabled()) {
      this.onload();
      this.loaded = true;
    }
  }

  disable(): void {
    if (!this.loaded) return;
    this.onunload();
    this.loaded = false;
  }

  onSettingsUpdate(): void {
    if (this.isEnabled() && !this.loaded) {
      this.enable();
    } else if (!this.isEnabled() && this.loaded) {
      this.disable();
    }
  }
}
