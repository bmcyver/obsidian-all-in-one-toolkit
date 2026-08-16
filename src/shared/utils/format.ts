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
