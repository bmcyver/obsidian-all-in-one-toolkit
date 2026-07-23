import { type Editor, Notice, TFile, Setting } from 'obsidian';
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
  showError,
  clearError,
  addErrorContainer,
  createToggleSection,
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
    this.plugin.registerEvent(
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
              .setTitle('노트 내 모든 이미지 WebP 변환')
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
          if (!this.isEnabled()) return;
          if (!evt.clipboardData?.items || evt.defaultPrevented) return;

          const files: File[] = [];
          for (let i = 0; i < evt.clipboardData.items.length; i++) {
            const item = evt.clipboardData.items[i];
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
    this.plugin.registerEvent(
      this.plugin.app.workspace.on(
        'editor-drop',
        (evt: DragEvent, editor: Editor) => {
          if (!this.isEnabled()) return;
          if (!evt.dataTransfer?.files || evt.defaultPrevented) return;

          const files: File[] = [];
          for (let i = 0; i < evt.dataTransfer.files.length; i++) {
            const file = evt.dataTransfer.files[i];
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
      new Notice(`변환 건너뜀: ${basename}\n(${originalSizeStr})`);
      return;
    }
    const createdSizeStr = formatBytes(convertedSize);
    const ratio = Math.round(
      ((originalSize - convertedSize) / originalSize) * 100,
    );
    new Notice(
      `변환 완료: ${basename}\n(${originalSizeStr} -> ${createdSizeStr} ${ratio}%)`,
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
      new Notice(`이미지 변환 실패: ${(err as Error).message}`);
    }
  }

  private async handleDropPasteEvents(
    sourceFiles: File[],
    editor: Editor,
  ): Promise<void> {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('이미지를 첨부할 활성 파일이 없습니다.');
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
          new Notice(`${sourceFile.name} 변환 실패: ${(err as Error).message}`);
          return null;
        }
      },
    );

    const markdownLinks: string[] = [];
    results.forEach((res) => {
      if (res) {
        createdFiles.push(res);
        markdownLinks.push(`![[${res.file.path}]]`);
      }
    });

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

    const linkedImageFiles = Object.keys(resolvedLinks)
      .map((link) => this.plugin.app.vault.getFileByPath(link))
      .filter(
        (file): file is TFile =>
          file instanceof TFile &&
          SUPPORTED_IMAGE_EXTENSIONS.includes(file.extension.toLowerCase()),
      );

    if (linkedImageFiles.length === 0) {
      new Notice('이 노트에서 변환 가능한 링크된 이미지를 찾지 못했습니다.');
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

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    results.forEach((r) => {
      if (r.status === 'rejected') {
        const errorMsg =
          r.reason instanceof Error ? r.reason.message : String(r.reason);
        new Notice(`${r.file.name} 변환 실패: ${errorMsg}`);
      }
    });

    new Notice(
      `이 노트에서 링크된 이미지 ${successCount}개를 WebP로 변환했습니다.`,
    );
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
      .setName('WebP 이미지 품질')
      .setDesc(
        '변환될 WebP 이미지의 품질을 설정합니다 (0-100). 품질이 높을수록 파일 크기가 커집니다.',
      );

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
            showError(qualityErrorEl, '숫자를 입력해 주세요.');
            return;
          }
          if (num < 0 || num > 100) {
            showError(
              qualityErrorEl,
              '품질 값은 0에서 100 사이의 숫자여야 합니다.',
            );
            return;
          }
          clearError(qualityErrorEl);
          this.plugin.settings.webpQuality = num;
          await this.plugin.saveSettings();
        })();
      });
    });

    const pathSetting = new Setting(detailEl)
      .setName('WebP 이미지 저장 경로')
      .setDesc('변환된 WebP 이미지를 저장할 폴더 경로를 설정합니다.');

    const pathErrorEl = addErrorContainer(pathSetting);

    pathSetting.addText((text) => {
      new FolderSuggest(this.plugin.app, text.inputEl);
      text.setValue(this.plugin.settings.imageStorePath || '');
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
