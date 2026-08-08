import { type App, normalizePath } from 'obsidian';

/**
 * Ensures that all directories in the given file path exist.
 * Creates missing parent directories recursively.
 */
export async function ensureDirectoryExists(
  app: App,
  filePath: string,
): Promise<void> {
  const normalized = normalizePath(filePath);
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex <= 0) return;

  const dirPath = normalized.slice(0, lastSlashIndex);
  const parts = dirPath.split('/');

  let currentPath = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    try {
      await app.vault.createFolder(currentPath);
    } catch {
      // Folder already exists or creation ignored
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
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/**
 * Formats bytes to human-readable size string (e.g. 1.2 MB).
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(1)} ${BYTE_UNITS[i]}`;
}

/**
 * Checks if the given path contains invalid characters for files/folders.
 */
export function isValidPath(path: string): boolean {
  return !/[*?"<>|:]/.test(path);
}

/**
 * Strips the folder prefix from a display path if it starts with the specified folder.
 */
export function stripFolderPrefix(path: string, folder: string): string {
  if (!folder) return path;
  const prefix = folder.endsWith('/') ? folder : `${folder}/`;
  if (path.toLowerCase().startsWith(prefix.toLowerCase())) {
    return path.slice(prefix.length);
  }
  return path;
}
