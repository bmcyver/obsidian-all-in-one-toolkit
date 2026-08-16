import { AbstractInputSuggest, type App, TFolder, TFile } from 'obsidian';
import { DEFAULT_SETTINGS } from '../../settings';
import { stripFolderPrefix } from '../utils/file';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, textInputEl: HTMLInputElement) {
    super(app, textInputEl);
  }

  getSuggestions(inputStr: string): TFolder[] {
    const folders = this.app.vault.getAllFolders();
    const lowerCaseInputStr = inputStr.toLowerCase();

    return folders.filter((folder) =>
      folder.path.toLowerCase().includes(lowerCaseInputStr),
    );
  }

  renderSuggestion(file: TFolder, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFolder): void {
    this.setValue(file.path);
    this.close();
  }
}

export class FileSuggest extends AbstractInputSuggest<TFile> {
  private templateFolder: string;

  constructor(app: App, textInputEl: HTMLInputElement, templateFolder: string) {
    super(app, textInputEl);
    this.templateFolder = templateFolder;
  }

  getSuggestions(inputStr: string): TFile[] {
    const files = this.app.vault.getFiles();
    const lowerCaseInputStr = inputStr.toLowerCase();
    const folderPath = (
      this.templateFolder || DEFAULT_SETTINGS.ejsTemplatesFolder
    ).toLowerCase();

    const suggestions: TFile[] = [];
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
    this.setValue(displayPath);
    this.close();
  }
}
