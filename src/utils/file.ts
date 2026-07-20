import type { App } from 'obsidian';

/**
 * Ensures that all directories in the given file path exist.
 * If not, it creates them recursively.
 */
export async function ensureDirectoryExists(
  app: App,
  filePath: string,
): Promise<void> {
  const parts = filePath.split('/').filter((p) => p);
  if (parts.length <= 1) return;

  // Remove filename
  parts.pop();

  let currentPath = '';
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    const exists = app.vault.getAbstractFileByPath(currentPath);
    if (!exists) {
      try {
        await app.vault.createFolder(currentPath);
      } catch {
        // Ignore folder exists error
      }
    }
  }
}

/**
 * Splits a file name into baseName and extension.
 */
export function splitFileName(
  fileNameWithExt: string,
): { baseName: string; ext: string } | null {
  const lastDot = fileNameWithExt.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === fileNameWithExt.length - 1) return null;
  return {
    baseName: fileNameWithExt.slice(0, lastDot),
    ext: fileNameWithExt.slice(lastDot + 1),
  };
}

/**
 * Normalizes file name by removing invalid characters and replacing spaces with underscores.
 */
export function normalizeFileName(name: string): string {
  return name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|[\]#^]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Formats bytes to human-readable size string (e.g. 1.2 MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Checks if the given path contains invalid characters.
 */
export function isValidPath(path: string): boolean {
  return !/[*?"<>|:]/.test(path);
}

/**
 * Strips the folder prefix from a display path if it starts with the specified folder.
 */
export function stripFolderPrefix(path: string, folder: string): string {
  if (path.toLowerCase().startsWith(folder.toLowerCase() + '/')) {
    return path.slice(folder.length + 1);
  }
  return path;
}
