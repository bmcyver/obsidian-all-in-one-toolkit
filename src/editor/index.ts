import type { Extension } from '@codemirror/state';
import type AllInOneToolkitPlugin from '../main';
import { createEJSHighlightExtension } from './ejs-highlight';
import {
  createEJSAutocompleteExtension,
  isEJSTemplateFile,
} from './ejs-autocomplete';

/**
 * Creates and bundles all EJS editor extensions (syntax highlighting & autocomplete).
 */
export function createEJSEditorExtension(
  plugin: AllInOneToolkitPlugin,
): Extension {
  return [
    createEJSHighlightExtension(plugin),
    createEJSAutocompleteExtension(plugin),
  ];
}

export { isEJSTemplateFile };
