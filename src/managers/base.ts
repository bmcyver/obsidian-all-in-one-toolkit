import { Component } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';

export abstract class BaseManager extends Component {
  private isManagerEnabled = false;

  constructor(public readonly plugin: AllInOneToolkitPlugin) {
    super();
  }

  abstract override onload(): void;

  override onunload(): void {
    // Optional cleanup logic in subclasses
  }

  renderSettings(containerEl: HTMLElement): void {
    // Optional settings UI rendering logic
  }

  protected isEnabled(): boolean {
    return true; // Default to always enabled
  }

  enable(): void {
    if (this.isManagerEnabled) return;
    if (this.isEnabled()) {
      this.load();
      this.isManagerEnabled = true;
    }
  }

  disable(): void {
    if (!this.isManagerEnabled) return;
    this.unload();
    this.isManagerEnabled = false;
  }

  onSettingsUpdate(): void {
    if (this.isEnabled() && !this.isManagerEnabled) {
      this.enable();
    } else if (!this.isEnabled() && this.isManagerEnabled) {
      this.disable();
    }
  }
}
