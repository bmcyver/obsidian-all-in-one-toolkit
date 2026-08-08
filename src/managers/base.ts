import type { EventRef } from 'obsidian';
import AllInOneToolkitPlugin from '../main';

export abstract class BaseManager {
  private loaded = false;
  protected eventRefs: EventRef[] = [];

  constructor(public readonly plugin: AllInOneToolkitPlugin) {}

  abstract onload(): void;

  onunload(): void {
    // Optional cleanup logic in subclasses
  }

  renderSettings(containerEl: HTMLElement): void {
    // Optional settings UI rendering logic
  }

  protected isEnabled(): boolean {
    return true; // Default to always enabled
  }

  protected registerEventRef(ref: EventRef): void {
    this.eventRefs.push(ref);
  }

  protected detachEventRefs(): void {
    for (let i = 0; i < this.eventRefs.length; i++) {
      const ref = this.eventRefs[i];
      if (ref) {
        this.plugin.app.workspace.offref(ref);
        this.plugin.app.vault.offref(ref);
      }
    }
    this.eventRefs = [];
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
    this.detachEventRefs();
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
