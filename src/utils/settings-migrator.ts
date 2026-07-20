import { DEFAULT_SETTINGS } from '../settings';
import type { ToolkitSettings } from '../settings';

function getBoolean(
  d: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const val = d[key];
  return typeof val === 'boolean' ? val : fallback;
}

function getString(
  d: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const val = d[key];
  return typeof val === 'string' ? val : fallback;
}

function getNumber(
  d: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const val = d[key];
  return typeof val === 'number' ? val : fallback;
}

export function migrateSettings(data: unknown): ToolkitSettings {
  const d = (data && typeof data === 'object' ? data : {}) as Record<
    string,
    unknown
  >;

  // quality and defaultCreateExtension are legacy keys
  const webpQuality =
    typeof d.webpQuality === 'number'
      ? d.webpQuality
      : getNumber(d, 'quality', DEFAULT_SETTINGS.webpQuality);

  const folderNoteExtension =
    typeof d.folderNoteExtension === 'string'
      ? d.folderNoteExtension
      : getString(
          d,
          'defaultCreateExtension',
          DEFAULT_SETTINGS.folderNoteExtension,
        );

  return {
    periodicNotesEnabled: getBoolean(
      d,
      'periodicNotesEnabled',
      DEFAULT_SETTINGS.periodicNotesEnabled,
    ),
    folderNoteEnabled: getBoolean(
      d,
      'folderNoteEnabled',
      DEFAULT_SETTINGS.folderNoteEnabled,
    ),
    imageConverterEnabled: getBoolean(
      d,
      'imageConverterEnabled',
      DEFAULT_SETTINGS.imageConverterEnabled,
    ),
    trashManagerEnabled: getBoolean(
      d,
      'trashManagerEnabled',
      DEFAULT_SETTINGS.trashManagerEnabled,
    ),
    scrollEnabled: getBoolean(
      d,
      'scrollEnabled',
      DEFAULT_SETTINGS.scrollEnabled,
    ),
    ejsEnabled: getBoolean(d, 'ejsEnabled', DEFAULT_SETTINGS.ejsEnabled),

    webpQuality,
    imageStorePath: getString(
      d,
      'imageStorePath',
      DEFAULT_SETTINGS.imageStorePath,
    ),
    folderNoteExtension,
    scrollSpeed: getNumber(d, 'scrollSpeed', DEFAULT_SETTINGS.scrollSpeed),
    ejsTemplatesFolder: getString(
      d,
      'ejsTemplatesFolder',
      DEFAULT_SETTINGS.ejsTemplatesFolder,
    ),
    ejsRules: Array.isArray(d.ejsRules)
      ? d.ejsRules.map((rule: unknown) => {
          const r =
            rule && typeof rule === 'object'
              ? (rule as Record<string, unknown>)
              : {};
          return {
            pattern: getString(r, 'pattern', ''),
            templatePath: getString(r, 'templatePath', ''),
          };
        })
      : DEFAULT_SETTINGS.ejsRules,
    periodicNotesFolder: getString(
      d,
      'periodicNotesFolder',
      DEFAULT_SETTINGS.periodicNotesFolder,
    ),
  };
}
