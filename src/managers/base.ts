export class BaseManager {
  onload(): void {
    // Must be implemented by subclass
  }

  onunload(): void {
    // Must be implemented by subclass
  }

  renderSettings(containerEl: HTMLElement): void {
    // Optional settings UI rendering logic
  }
}
