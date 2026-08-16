import { Component } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';

export abstract class Feature extends Component {
  constructor(public readonly plugin: AllInOneToolkitPlugin) {
    super();
  }

  abstract override onload(): void;

  override onunload(): void {
    // Optional cleanup logic in subclasses
  }

  renderSettings(_containerEl: HTMLElement): void {
    // Optional settings UI rendering logic
  }

  onSettingsUpdate(): void {
    // Optional hook called when settings are saved
  }
}
