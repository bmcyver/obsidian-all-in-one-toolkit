import { DEFAULT_SETTINGS } from '../settings';
import type { ToolkitSettings } from '../settings';

export function migrateSettings(data: unknown): ToolkitSettings {
  const d = (data && typeof data === 'object' ? data : {}) as Record<
    string,
    unknown
  >;
  return {
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
      ? (d.ejsRules as ToolkitSettings['ejsRules'])
      : DEFAULT_SETTINGS.ejsRules,
    periodicNotesFolder:
      typeof d.periodicNotesFolder === 'string'
        ? d.periodicNotesFolder
        : DEFAULT_SETTINGS.periodicNotesFolder,
  };
}
