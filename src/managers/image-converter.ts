import { type Editor, Notice, TFile, Setting } from 'obsidian';
import type AllInOneToolkitPlugin from '../main';
import {
  SUPPORTED_IMAGE_EXTENSIONS,
  CONVERTED_NAME_REGEX,
  isAvifFile,
  isValidImageFile,
  getImageMimeType,
  toWebP,
} from '../utils/image';
import {
  normalizeFileName,
  ensureDirectoryExists,
  formatBytes,
  isValidPath,
} from '../utils/file';
import { BaseManager } from './base';
import { FolderSuggest } from '../ui/folder-suggest';

export class ImageConverterManager implements BaseManager {
  plugin: AllInOneToolkitPlugin;

  constructor(plugin: AllInOneToolkitPlugin) {
    this.plugin = plugin;
  }

  private buildAssetPath(basename: string, extension: string): string {
    const storePathSetting =
      this.plugin.settings.imageStorePath || 'assets/YYYY';
    const resolvedFolder = window.moment().format(storePathSetting);
    return `${resolvedFolder}/${normalizeFileName(basename)}-${Date.now()}.${extension}`;
  }

  onload() {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('file-menu', (menu, targetFile) => {
        if (!(targetFile instanceof TFile)) return;

        const ext = targetFile.extension.toLowerCase();
        if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
          menu.addItem((item) => {
            item
              .setTitle('Convert image')
              .setIcon('image-down')
              .onClick(() => void this.handleFileMenuEvent(targetFile));
          });
        } else if (ext === 'md') {
          menu.addItem((item) => {
            item
              .setTitle('Convert all images')
              .setIcon('image-down')
              .onClick(() => void this.handleMarkdownMenuEvent(targetFile));
          });
        }
      }),
    );

    // Paste handler
    this.plugin.registerEvent(
      this.plugin.app.workspace.on(
        'editor-paste',
        (evt: ClipboardEvent, editor: Editor) => {
          if (!evt.clipboardData?.items || evt.defaultPrevented) return;

          let file: File | null = null;
          for (const item of evt.clipboardData.items) {
            if (item.kind === 'file') {
              file = item.getAsFile();
              break;
            }
          }

          if (!file || !isValidImageFile(file)) return;

          evt.preventDefault();
          void this.handleDropPasteEvent(file, editor);
          return true;
        },
      ),
    );

    // Drop handler
    this.plugin.registerEvent(
      this.plugin.app.workspace.on(
        'editor-drop',
        (evt: DragEvent, editor: Editor) => {
          if (!evt.dataTransfer?.files?.[0] || evt.defaultPrevented) return;

          const file = evt.dataTransfer.files[0];
          if (!file || !isValidImageFile(file)) return;

          evt.preventDefault();
          void this.handleDropPasteEvent(file, editor);
          return true;
        },
      ),
    );
  }

  onunload() {
    // Lifecycle cleanup placeholder
  }

  private async convertImage(
    file: File | TFile,
    isAvif: boolean,
  ): Promise<ArrayBuffer> {
    if (isAvif) {
      if (file instanceof TFile) {
        return this.plugin.app.vault.readBinary(file);
      } else {
        return file.arrayBuffer();
      }
    }
    const sourceFile =
      file instanceof TFile
        ? new File([await this.plugin.app.vault.readBinary(file)], file.name, {
            type: getImageMimeType(file.extension.toLowerCase()),
          })
        : file;

    return toWebP(sourceFile, this.plugin.settings.webpQuality);
  }

  private showConversionNotice(
    basename: string,
    originalSize: number,
    convertedSize: number,
    skipped: boolean,
  ) {
    const originalSizeStr = formatBytes(originalSize);
    if (skipped) {
      new Notice(`Skipped ${basename}\n(${originalSizeStr})`);
      return;
    }
    const createdSizeStr = formatBytes(convertedSize);
    const ratio = Math.round(
      ((originalSize - convertedSize) / originalSize) * 100,
    );
    new Notice(
      `Converted ${basename}\n(${originalSizeStr} -> ${createdSizeStr} ${ratio}%)`,
    );
  }

  private async handleFileMenuEvent(
    sourceFile: TFile,
    noteBasename?: string,
  ): Promise<void> {
    if (CONVERTED_NAME_REGEX.test(sourceFile.name)) {
      new Notice('This file seems to be already converted.');
      return;
    }

    const sourceExtension = sourceFile.extension.toLowerCase();
    const shouldSkipConversion = isAvifFile(sourceExtension);

    // Resolve target basename: prioritize passed noteBasename, fallback to backlink notes, fallback to image basename
    let targetBasename = noteBasename;
    if (!targetBasename) {
      const backlinks: string[] = [];
      const targetPath = sourceFile.path;
      for (const [sourcePath, links] of Object.entries(
        this.plugin.app.metadataCache.resolvedLinks,
      )) {
        if (links[targetPath]) {
          const file = this.plugin.app.vault.getFileByPath(sourcePath);
          if (file) {
            backlinks.push(file.basename);
          }
        }
      }
      targetBasename = backlinks[0] || sourceFile.basename;
    }

    const destinationPath = this.buildAssetPath(
      targetBasename,
      shouldSkipConversion ? 'avif' : 'webp',
    );

    await ensureDirectoryExists(this.plugin.app, destinationPath);

    try {
      const originalSize = sourceFile.stat.size;
      const outputData = await this.convertImage(
        sourceFile,
        shouldSkipConversion,
      );

      if (shouldSkipConversion) {
        await this.plugin.app.fileManager.renameFile(
          sourceFile,
          destinationPath,
        );
      } else {
        await this.plugin.app.vault.modifyBinary(sourceFile, outputData);
        await this.plugin.app.fileManager.renameFile(
          sourceFile,
          destinationPath,
        );
      }

      this.showConversionNotice(
        sourceFile.basename,
        originalSize,
        outputData.byteLength,
        shouldSkipConversion,
      );
    } catch (err) {
      new Notice(`Failed to convert image: ${(err as Error).message}`);
    }
  }

  private async handleDropPasteEvent(
    sourceFile: File,
    editor: Editor,
  ): Promise<void> {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file to attach the image to.');
      return;
    }

    const shouldSkipConversion = isAvifFile(sourceFile);
    const destinationPath = this.buildAssetPath(
      activeFile.basename,
      shouldSkipConversion ? 'avif' : 'webp',
    );

    await ensureDirectoryExists(this.plugin.app, destinationPath);

    try {
      const outputData = await this.convertImage(
        sourceFile,
        shouldSkipConversion,
      );
      const createdFile = await this.plugin.app.vault.createBinary(
        destinationPath,
        outputData,
      );

      editor.replaceSelection(`![[${createdFile.path}]]`);

      this.showConversionNotice(
        createdFile.basename,
        sourceFile.size,
        createdFile.stat.size,
        shouldSkipConversion,
      );
    } catch (err) {
      new Notice(`Failed to convert image: ${(err as Error).message}`);
    }
  }

  private async handleMarkdownMenuEvent(noteFile: TFile): Promise<void> {
    const resolvedLinks =
      this.plugin.app.metadataCache.resolvedLinks[noteFile.path];
    if (!resolvedLinks) {
      new Notice('Failed to read file metadata.');
      return;
    }

    const linkedImageFiles = Object.keys(resolvedLinks)
      .map((link) => this.plugin.app.vault.getFileByPath(link))
      .filter(
        (file): file is TFile =>
          file instanceof TFile &&
          SUPPORTED_IMAGE_EXTENSIONS.includes(file.extension.toLowerCase()),
      );

    if (linkedImageFiles.length === 0) {
      new Notice('No supported linked images found in this note.');
      return;
    }

    let successCount = 0;
    for (const imageFile of linkedImageFiles) {
      try {
        await this.handleFileMenuEvent(imageFile, noteFile.basename);
        successCount++;
      } catch (error) {
        new Notice(
          `Failed to convert ${imageFile.name}: ${(error as Error).message}`,
        );
      }
    }

    new Notice(`Converted ${successCount} linked image(s) in this note.`);
  }

  renderSettings(containerEl: HTMLElement) {
    new Setting(containerEl).setName('이미지 WebP 변환').setHeading();

    new Setting(containerEl)
      .setName('WebP 이미지 품질')
      .setDesc(
        '변환될 WebP 이미지의 품질을 설정합니다 (0-100). 품질이 높을수록 파일 크기가 커집니다.',
      )
      .addText((text) => {
        text.inputEl.type = 'number';
        text.inputEl.min = '0';
        text.inputEl.max = '100';
        text.setValue(String(this.plugin.settings.webpQuality));
        text.onChange(async (value) => {
          let num = parseInt(value, 10);
          if (isNaN(num)) return;
          num = Math.max(0, Math.min(100, num));
          this.plugin.settings.webpQuality = num;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('WebP 이미지 저장 경로')
      .setDesc(
        '변환된 WebP 이미지를 저장할 폴더 경로를 설정합니다. 현재 연도를 나타내는 YYYY 포맷을 지원합니다 (예: assets/YYYY). 대괄호 [ ]로 감싸인 부분은 치환되지 않고 그대로 사용됩니다.',
      )
      .addText((text) => {
        new FolderSuggest(this.plugin.app, text.inputEl);
        text.setValue(this.plugin.settings.imageStorePath || '');
        text.onChange(async (value) => {
          const trimmed = value.trim();
          if (!isValidPath(trimmed)) {
            new Notice('경로에 사용할 수 없는 문자가 포함되어 있습니다.');
            return;
          }
          this.plugin.settings.imageStorePath = trimmed;
          await this.plugin.saveSettings();
        });
      });
  }
}
