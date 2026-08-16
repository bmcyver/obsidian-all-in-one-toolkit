import { type App, normalizePath } from 'obsidian';

/**
 * Ensures that parent directories in the given file path exist using Vault Adapter.
 */
export async function ensureDirectoryExists(
  app: App,
  filePath: string,
): Promise<void> {
  const normalized = normalizePath(filePath);
  const lastSlashIndex = normalized.lastIndexOf('/');
  if (lastSlashIndex <= 0) return;

  const dirPath = normalized.slice(0, lastSlashIndex);
  if (!(await app.vault.adapter.exists(dirPath))) {
    await app.vault.adapter.mkdir(dirPath);
  }
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
