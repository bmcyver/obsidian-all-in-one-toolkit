import { type Editor, Notice, Setting, TFile } from 'obsidian';
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
import { DEFAULT_SETTINGS } from '../settings';
import {
  createToggleSection,
  addErrorContainer,
  showError,
  clearError,
} from '../utils/ui';
import { limitConcurrency } from '../utils/async';

export class ImageConverterManager extends BaseManager {
  private assetPathCounter = 0;

  protected isEnabled(): boolean {
    return this.plugin.settings.imageConverterEnabled;
  }

  private buildAssetPath(basename: string, extension: string): string {
    const storePathSetting =
      this.plugin.settings.imageStorePath || DEFAULT_SETTINGS.imageStorePath;
    const resolvedFolder = window.moment().format(storePathSetting);
    this.assetPathCounter = (this.assetPathCounter + 1) % 10000;
    const uniqueId = `${Date.now()}-${this.assetPathCounter}`;
    return `${resolvedFolder}/${normalizeFileName(basename)}-${uniqueId}.${extension}`;
  }

  onload() {
    this.registerEventRef(
      this.plugin.app.workspace.on('file-menu', (menu, targetFile) => {
        if (!this.isEnabled()) return;
        if (!(targetFile instanceof TFile)) return;

        const ext = targetFile.extension.toLowerCase();
        if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
          menu.addItem((item) => {
            item
              .setTitle('이미지 WebP 변환')
              .setIcon('image-down')
              .onClick(() => void this.handleFileMenuEvent(targetFile));
          });
        } else if (ext === 'md') {
          menu.addItem((item) => {
            item
              .setTitle('노트 내 이미지 전체 WebP 변환')
              .setIcon('image-down')
              .onClick(() => void this.handleMarkdownMenuEvent(targetFile));
          });
        }
      }),
    );

    // Paste handler
    this.registerEventRef(
      this.plugin.app.workspace.on(
        'editor-paste',
        (evt: ClipboardEvent, editor: Editor) => {
          if (!this.isEnabled()) return;
          if (!evt.clipboardData?.items || evt.defaultPrevented) return;

          const files: File[] = [];
          for (const item of Array.from(evt.clipboardData.items)) {
            if (item?.kind === 'file') {
              const file = item.getAsFile();
              if (file && isValidImageFile(file)) {
                files.push(file);
              }
            }
          }

          if (files.length === 0) return;

          evt.preventDefault();
          void this.handleDropPasteEvents(files, editor);
          return true;
        },
      ),
    );

    // Drop handler
    this.registerEventRef(
      this.plugin.app.workspace.on(
        'editor-drop',
        (evt: DragEvent, editor: Editor) => {
          if (!this.isEnabled()) return;
          if (!evt.dataTransfer?.files || evt.defaultPrevented) return;

          const files: File[] = [];
          for (const file of Array.from(evt.dataTransfer.files)) {
            if (file && isValidImageFile(file)) {
              files.push(file);
            }
          }

          if (files.length === 0) return;

          evt.preventDefault();
          void this.handleDropPasteEvents(files, editor);
          return true;
        },
      ),
    );
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
      new Notice(`변환 생략: ${basename} (${originalSizeStr})`);
      return;
    }
    const createdSizeStr = formatBytes(convertedSize);
    const ratio = Math.round(
      ((originalSize - convertedSize) / Math.max(1, originalSize)) * 100,
    );
    new Notice(
      `WebP 변환 완료: ${basename} (${originalSizeStr} → ${createdSizeStr}, -${ratio}%)`,
    );
  }

  private async handleFileMenuEvent(
    sourceFile: TFile,
    noteBasename?: string,
  ): Promise<void> {
    if (CONVERTED_NAME_REGEX.test(sourceFile.name)) {
      new Notice('이미 WebP로 변환된 이미지입니다.');
      return;
    }

    const sourceExtension = sourceFile.extension.toLowerCase();
    const shouldSkipConversion = isAvifFile(sourceExtension);

    let targetBasename = noteBasename;
    if (!targetBasename) {
      const targetPath = sourceFile.path;
      for (const [sourcePath, links] of Object.entries(
        this.plugin.app.metadataCache.resolvedLinks,
      )) {
        if (links[targetPath]) {
          const file = this.plugin.app.vault.getFileByPath(sourcePath);
          if (file) {
            targetBasename = file.basename;
            break;
          }
        }
      }
      if (!targetBasename) {
        targetBasename = sourceFile.basename;
      }
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
        await this.plugin.app.fileManager.renameFile(
          sourceFile,
          destinationPath,
        );
        await this.plugin.app.vault.modifyBinary(sourceFile, outputData);
      }

      this.showConversionNotice(
        sourceFile.basename,
        originalSize,
        outputData.byteLength,
        shouldSkipConversion,
      );
    } catch (err) {
      new Notice(
        `이미지 변환 실패 (${sourceFile.basename}): ${(err as Error).message}`,
      );
    }
  }

  private async handleDropPasteEvents(
    sourceFiles: File[],
    editor: Editor,
  ): Promise<void> {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('이미지를 첨부할 활성 노트가 없습니다.');
      return;
    }

    const createdFiles: {
      file: TFile;
      originalName: string;
      originalSize: number;
      skipped: boolean;
    }[] = [];

    const results = await limitConcurrency(
      sourceFiles,
      3,
      async (sourceFile) => {
        try {
          const shouldSkipConversion = isAvifFile(sourceFile);
          const destinationPath = this.buildAssetPath(
            activeFile.basename,
            shouldSkipConversion ? 'avif' : 'webp',
          );

          await ensureDirectoryExists(this.plugin.app, destinationPath);

          const outputData = await this.convertImage(
            sourceFile,
            shouldSkipConversion,
          );
          const createdFile = await this.plugin.app.vault.createBinary(
            destinationPath,
            outputData,
          );

          return {
            file: createdFile,
            originalName: sourceFile.name,
            originalSize: sourceFile.size,
            skipped: shouldSkipConversion,
          };
        } catch (err) {
          new Notice(
            `이미지 변환 실패 (${sourceFile.name}): ${(err as Error).message}`,
          );
          return null;
        }
      },
    );

    const markdownLinks: string[] = [];
    for (const res of results) {
      if (res) {
        createdFiles.push(res);
        markdownLinks.push(`![[${res.file.path}]]`);
      }
    }

    if (markdownLinks.length > 0) {
      editor.replaceSelection(markdownLinks.join('\n'));
    }

    if (createdFiles.length === 1 && createdFiles[0]) {
      const single = createdFiles[0];
      this.showConversionNotice(
        single.file.basename,
        single.originalSize,
        single.file.stat.size,
        single.skipped,
      );
    } else if (createdFiles.length > 1) {
      new Notice(`이미지 ${createdFiles.length}개 WebP 변환 및 첨부 완료`);
    }
  }

  private async handleMarkdownMenuEvent(noteFile: TFile): Promise<void> {
    const resolvedLinks =
      this.plugin.app.metadataCache.resolvedLinks[noteFile.path];
    if (!resolvedLinks) {
      new Notice('파일 메타데이터를 읽지 못했습니다.');
      return;
    }

    const linkedImageFiles: TFile[] = [];
    for (const link of Object.keys(resolvedLinks)) {
      const file = this.plugin.app.vault.getFileByPath(link);
      if (
        file instanceof TFile &&
        SUPPORTED_IMAGE_EXTENSIONS.includes(file.extension.toLowerCase())
      ) {
        linkedImageFiles.push(file);
      }
    }

    if (linkedImageFiles.length === 0) {
      new Notice('변환 가능한 이미지를 찾지 못했습니다.');
      return;
    }

    const results = await limitConcurrency(
      linkedImageFiles,
      3,
      async (imageFile) => {
        try {
          await this.handleFileMenuEvent(imageFile, noteFile.basename);
          return { status: 'fulfilled' as const, file: imageFile };
        } catch (reason) {
          return { status: 'rejected' as const, file: imageFile, reason };
        }
      },
    );

    let successCount = 0;
    for (const r of results) {
      if (r.status === 'fulfilled') {
        successCount++;
      } else if (r.status === 'rejected') {
        const errorMsg =
          r.reason instanceof Error ? r.reason.message : String(r.reason);
        new Notice(`이미지 변환 실패 (${r.file.name}): ${errorMsg}`);
      }
    }

    new Notice(`이미지 ${successCount}개 WebP 변환 완료`);
  }

  renderSettings(containerEl: HTMLElement) {
    const detailEl = createToggleSection(
      containerEl,
      '이미지 WebP 변환',
      this.plugin.settings.imageConverterEnabled,
      async (value) => {
        this.plugin.settings.imageConverterEnabled = value;
        await this.plugin.saveSettings();
      },
    );

    const qualitySetting = new Setting(detailEl)
      .setName('WebP 품질')
      .setDesc('변환할 WebP 이미지 품질을 설정합니다 (0-100).');

    const qualityErrorEl = addErrorContainer(qualitySetting);

    qualitySetting.addText((text) => {
      text.inputEl.type = 'number';
      text.inputEl.min = '0';
      text.inputEl.max = '100';
      text.setValue(String(this.plugin.settings.webpQuality));

      text.onChange((value) => {
        void (async () => {
          const num = parseInt(value, 10);
          if (value.trim() === '' || isNaN(num)) {
            showError(qualityErrorEl, '올바른 숫자를 입력해 주세요.');
            return;
          }
          if (num < 0 || num > 100) {
            showError(qualityErrorEl, '0에서 100 사이의 숫자를 입력해 주세요.');
            return;
          }
          clearError(qualityErrorEl);
          this.plugin.settings.webpQuality = num;
          await this.plugin.saveSettings();
        })();
      });
    });

    const pathSetting = new Setting(detailEl)
      .setName('WebP 저장 경로')
      .setDesc('변환된 WebP 이미지가 저장될 폴더 경로입니다.');

    const pathErrorEl = addErrorContainer(pathSetting);

    pathSetting.addText((text) => {
      text.setValue(this.plugin.settings.imageStorePath || '');
      new FolderSuggest(this.plugin.app, text.inputEl);

      text.onChange((value) => {
        void (async () => {
          const trimmed = value.trim();
          if (!isValidPath(trimmed)) {
            showError(
              pathErrorEl,
              '경로에 사용할 수 없는 문자가 포함되어 있습니다.',
            );
            return;
          }
          clearError(pathErrorEl);
          this.plugin.settings.imageStorePath = trimmed;
          await this.plugin.saveSettings();
        })();
      });
    });
  }
}
