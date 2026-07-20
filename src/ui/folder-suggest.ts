import { AbstractInputSuggest, type App, TFolder, TFile } from 'obsidian';
import { DEFAULT_SETTINGS } from '../settings';
import { stripFolderPrefix } from '../utils/file';

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
    const folderPath = (
      this.templateFolder || DEFAULT_SETTINGS.ejsTemplatesFolder
    ).toLowerCase();

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
    const folderPath =
      this.templateFolder || DEFAULT_SETTINGS.ejsTemplatesFolder;
    const displayPath = stripFolderPrefix(file.path, folderPath);
    el.setText(displayPath);
  }

  selectSuggestion(file: TFile): void {
    const folderPath =
      this.templateFolder || DEFAULT_SETTINGS.ejsTemplatesFolder;
    const displayPath = stripFolderPrefix(file.path, folderPath);
    this.inputEl.value = displayPath;
    this.inputEl.dispatchEvent(new Event('input'));
    this.close();
  }
}
