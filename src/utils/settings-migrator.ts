import { DEFAULT_SETTINGS } from '../settings';
import type { ToolkitSettings } from '../settings';

export function migrateSettings(data: unknown): ToolkitSettings {
  const d = (data && typeof data === 'object' ? data : {}) as Record<
    string,
    unknown
  >;
  return {
    periodicNotesEnabled:
      typeof d.periodicNotesEnabled === 'boolean'
        ? d.periodicNotesEnabled
        : DEFAULT_SETTINGS.periodicNotesEnabled,
    folderNoteEnabled:
      typeof d.folderNoteEnabled === 'boolean'
        ? d.folderNoteEnabled
        : DEFAULT_SETTINGS.folderNoteEnabled,
    imageConverterEnabled:
      typeof d.imageConverterEnabled === 'boolean'
        ? d.imageConverterEnabled
        : DEFAULT_SETTINGS.imageConverterEnabled,
    trashManagerEnabled:
      typeof d.trashManagerEnabled === 'boolean'
        ? d.trashManagerEnabled
        : DEFAULT_SETTINGS.trashManagerEnabled,
    scrollEnabled:
      typeof d.scrollEnabled === 'boolean'
        ? d.scrollEnabled
        : DEFAULT_SETTINGS.scrollEnabled,
    ejsEnabled:
      typeof d.ejsEnabled === 'boolean'
        ? d.ejsEnabled
        : DEFAULT_SETTINGS.ejsEnabled,

    webpQuality:
      typeof d.webpQuality === 'number'
        ? d.webpQuality
        : typeof d.quality === 'number'
          ? d.quality
          : DEFAULT_SETTINGS.webpQuality,
    imageStorePath:
      typeof d.imageStorePath === 'string'
        ? d.imageStorePath
        : DEFAULT_SETTINGS.imageStorePath,
    folderNoteExtension:
      typeof d.folderNoteExtension === 'string'
        ? d.folderNoteExtension
        : typeof d.defaultCreateExtension === 'string'
          ? d.defaultCreateExtension
          : DEFAULT_SETTINGS.folderNoteExtension,
    scrollSpeed:
      typeof d.scrollSpeed === 'number'
        ? d.scrollSpeed
        : DEFAULT_SETTINGS.scrollSpeed,
    ejsTemplatesFolder:
      typeof d.ejsTemplatesFolder === 'string'
        ? d.ejsTemplatesFolder
        : DEFAULT_SETTINGS.ejsTemplatesFolder,
    ejsRules: Array.isArray(d.ejsRules)
      ? d.ejsRules.map((rule: unknown) => {
          const r =
            rule && typeof rule === 'object'
              ? (rule as Record<string, unknown>)
              : {};
          return {
            pattern: typeof r.pattern === 'string' ? r.pattern : '',
            templatePath:
              typeof r.templatePath === 'string' ? r.templatePath : '',
          };
        })
      : DEFAULT_SETTINGS.ejsRules,
    periodicNotesFolder:
      typeof d.periodicNotesFolder === 'string'
        ? d.periodicNotesFolder
        : DEFAULT_SETTINGS.periodicNotesFolder,
  };
}
