import { AbstractInputSuggest, type App, TFolder, TFile } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private inputEl: HTMLInputElement;

  constructor(app: App, textInputEl: HTMLInputElement) {
    super(app, textInputEl);
    this.inputEl = textInputEl;
  }

  getSuggestions(inputStr: string): TFolder[] {
    const abstractFiles = this.app.vault.getAllLoadedFiles();
    const folders: TFolder[] = [];
    const lowerCaseInputStr = inputStr.toLowerCase();

    for (const file of abstractFiles) {
      if (
        file instanceof TFolder &&
        file.path.toLowerCase().includes(lowerCaseInputStr)
      ) {
        folders.push(file);
      }
    }

    return folders;
  }

  renderSuggestion(file: TFolder, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFolder): void {
    this.inputEl.value = file.path;
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}

export class FileSuggest extends AbstractInputSuggest<TFile> {
  private inputEl: HTMLInputElement;
  private templateFolder: string;

  constructor(app: App, textInputEl: HTMLInputElement, templateFolder: string) {
    super(app, textInputEl);
    this.inputEl = textInputEl;
    this.templateFolder = templateFolder;
  }

  getSuggestions(inputStr: string): TFile[] {
    const files = this.app.vault.getFiles();
    const suggestions: TFile[] = [];
    const lowerCaseInputStr = inputStr.toLowerCase();
    const folderPath = (this.templateFolder || '90 - Templates').toLowerCase();

    for (const file of files) {
      if (!file.path.toLowerCase().startsWith(folderPath + '/')) continue;

      const ext = file.extension.toLowerCase();
      if (ext !== 'md' && ext !== 'ejs') continue;

      if (file.path.toLowerCase().includes(lowerCaseInputStr)) {
        suggestions.push(file);
      }
    }

    return suggestions;
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    let displayPath = file.path;
    const folderPath = this.templateFolder || '90 - Templates';
    if (displayPath.toLowerCase().startsWith(folderPath.toLowerCase() + '/')) {
      displayPath = displayPath.slice(folderPath.length + 1);
    }
    el.setText(displayPath);
  }

  selectSuggestion(file: TFile): void {
    let displayPath = file.path;
    const folderPath = this.templateFolder || '90 - Templates';
    if (displayPath.toLowerCase().startsWith(folderPath.toLowerCase() + '/')) {
      displayPath = displayPath.slice(folderPath.length + 1);
    }
    this.inputEl.value = displayPath;
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}
