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

export class ImageConverterManager extends BaseManager {
  protected isEnabled(): boolean {
    return this.plugin.settings.imageConverterEnabled;
  }

  private buildAssetPath(basename: string, extension: string): string {
    const storePathSetting =
      this.plugin.settings.imageStorePath || DEFAULT_SETTINGS.imageStorePath;
    const resolvedFolder = window.moment().format(storePathSetting);
    return `${resolvedFolder}/${normalizeFileName(basename)}-${Date.now()}.${extension}`;
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
          if (!this.isEnabled()) return;
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

  private async handleDropPasteEvent(
    sourceFile: File,
    editor: Editor,
  ): Promise<void> {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('이미지를 첨부할 활성 파일이 없습니다.');
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
      new Notice(`이미지 변환 실패: ${(err as Error).message}`);
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

    let successCount = 0;
    for (const imageFile of linkedImageFiles) {
      try {
        await this.handleFileMenuEvent(imageFile, noteFile.basename);
        successCount++;
      } catch (error) {
        new Notice(`${imageFile.name} 변환 실패: ${(error as Error).message}`);
      }
    }

    new Notice(
      `이 노트에서 링크된 이미지 ${successCount}개를 WebP로 변환했습니다.`,
    );
  }

  renderSettings(containerEl: HTMLElement) {
    new Setting(containerEl)
      .setName('이미지 WebP 변환')
      .setHeading()
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.imageConverterEnabled)
          .onChange(async (value) => {
            this.plugin.settings.imageConverterEnabled = value;
            await this.plugin.saveSettings();
            detailEl.style.display = value ? '' : 'none';
          });
      });

    const detailEl = containerEl.createDiv();
    detailEl.style.display = this.plugin.settings.imageConverterEnabled
      ? ''
      : 'none';

    const qualitySetting = new Setting(detailEl)
      .setName('WebP 이미지 품질')
      .setDesc(
        '변환될 WebP 이미지의 품질을 설정합니다 (0-100). 품질이 높을수록 파일 크기가 커집니다.',
      );
    qualitySetting.settingEl.addClass('has-error-container');

    const qualityErrorEl = qualitySetting.settingEl.createDiv({
      cls: 'setting-item-error is-hidden',
    });

    qualitySetting.addText((text) => {
      text.inputEl.type = 'number';
      text.inputEl.min = '0';
      text.inputEl.max = '100';
      text.setValue(String(this.plugin.settings.webpQuality));
      text.onChange((value) => {
        void (async () => {
          const num = parseInt(value, 10);
          if (value.trim() === '' || isNaN(num)) {
            qualityErrorEl.textContent = '숫자를 입력해 주세요.';
            qualityErrorEl.removeClass('is-hidden');
            return;
          }
          if (num < 0 || num > 100) {
            qualityErrorEl.textContent =
              '품질 값은 0에서 100 사이의 숫자여야 합니다.';
            qualityErrorEl.removeClass('is-hidden');
            return;
          }
          qualityErrorEl.addClass('is-hidden');
          qualityErrorEl.textContent = '';
          this.plugin.settings.webpQuality = num;
          await this.plugin.saveSettings();
        })();
      });
    });

    const pathSetting = new Setting(detailEl)
      .setName('WebP 이미지 저장 경로')
      .setDesc('변환된 WebP 이미지를 저장할 폴더 경로를 설정합니다.');
    pathSetting.settingEl.addClass('has-error-container');

    const pathErrorEl = pathSetting.settingEl.createDiv({
      cls: 'setting-item-error is-hidden',
    });

    pathSetting.addText((text) => {
      new FolderSuggest(this.plugin.app, text.inputEl);
      text.setValue(this.plugin.settings.imageStorePath || '');
      text.onChange((value) => {
        void (async () => {
          const trimmed = value.trim();
          if (!isValidPath(trimmed)) {
            pathErrorEl.textContent =
              '경로에 사용할 수 없는 문자가 포함되어 있습니다.';
            pathErrorEl.removeClass('is-hidden');
            return;
          }
          pathErrorEl.addClass('is-hidden');
          pathErrorEl.textContent = '';
          this.plugin.settings.imageStorePath = trimmed;
          await this.plugin.saveSettings();
        })();
      });
    });
  }
}
