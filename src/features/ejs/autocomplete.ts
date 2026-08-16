import { editorInfoField, normalizePath } from 'obsidian';
import type { Extension, EditorState } from '@codemirror/state';
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import type AllInOneToolkitPlugin from '../../main';

/**
 * Checks whether the current editor state is editing a markdown file (*.md)
 * inside the configured EJS templates folder using Obsidian's TFile parent hierarchy.
 */
export function isEJSTemplateFile(
  state: EditorState,
  templatesFolder: string,
): boolean {
  const file = state.field(editorInfoField, false)?.file;
  if (!file || file.extension !== 'md') {
    return false;
  }

  const normalizedFolder = normalizePath(templatesFolder || 'Templates');
  if (
    !normalizedFolder ||
    normalizedFolder === '/' ||
    normalizedFolder === '.'
  ) {
    return true;
  }

  let currentParent = file.parent;
  while (currentParent) {
    if (currentParent.path === normalizedFolder) {
      return true;
    }
    currentParent = currentParent.parent;
  }

  return false;
}

/**
 * Checks whether the cursor at pos is inside an unclosed `<% ... %>` tag.
 */
function isInsideEJSTag(docText: string, pos: number): boolean {
  const textBefore = docText.slice(0, pos);
  const lastOpen = textBefore.lastIndexOf('<%');
  const lastClose = textBefore.lastIndexOf('%>');

  return lastOpen !== -1 && (lastClose === -1 || lastOpen > lastClose);
}

/**
 * Custom APIs provided in the EJS render context.
 */
const CUSTOM_EJS_GLOBALS: Completion[] = [
  {
    label: 'title',
    type: 'variable',
    detail: 'string',
    info: '생성할 파일의 기본 제목 (확장자 제외)',
  },
  {
    label: 'file',
    type: 'variable',
    detail: 'TFile',
    info: '현재 대상 TFile 객체',
  },
  {
    label: 'app',
    type: 'variable',
    detail: 'App',
    info: 'Obsidian App 인스턴스',
  },
  {
    label: 'moment',
    type: 'function',
    detail: 'Moment',
    info: 'Moment.js 날짜/시간 포맷팅 유틸리티',
  },
  {
    label: 'ejs',
    type: 'variable',
    detail: 'EJSToolkitHelpers',
    info: 'EJS 플러그인 헬퍼 네임스페이스 (ejs.prompt, ejs.select 등)',
  },
];

/**
 * Dynamically inspects an object and its prototype chain to extract all accessible properties and methods safely.
 */
function extractDynamicProperties(target: unknown): Completion[] {
  if (target === null || target === undefined) {
    return [];
  }

  const propMap = new Map<string, 'property' | 'function'>();
  let current: unknown = target;

  // Traverse prototype chain up to Object.prototype
  for (
    let depth = 0;
    depth < 4 && current && current !== Object.prototype;
    depth++
  ) {
    const descriptors = Object.getOwnPropertyDescriptors(current);
    for (const [key, desc] of Object.entries(descriptors)) {
      if (
        key === 'constructor' ||
        key.startsWith('__') ||
        key.startsWith('_')
      ) {
        continue;
      }

      if (!propMap.has(key)) {
        if (typeof desc.value === 'function') {
          propMap.set(key, 'function');
        } else {
          propMap.set(key, 'property');
        }
      }
    }

    current = Object.getPrototypeOf(current);
  }

  return Array.from(propMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, type]) => ({
      label: key,
      type,
    }));
}

/**
 * Resolves dot-separated member access path (e.g. ['app', 'vault']) to the runtime instance.
 */
function resolveRuntimeObject(
  segments: string[],
  plugin: AllInOneToolkitPlugin,
  currentFile: unknown,
): unknown {
  if (segments.length === 0) {
    return null;
  }

  const rootName = segments[0];
  let current: unknown = null;

  if (rootName === 'app') {
    current = plugin.app;
  } else if (rootName === 'file') {
    current = currentFile || plugin.app.workspace.getActiveFile();
  } else if (rootName === 'moment') {
    current = window.moment;
  } else if (rootName === 'ejs') {
    current = {
      prompt: (msg: string, defaultValue?: string) => Promise.resolve(''),
      select: (msg: string, items: string[], values?: string[]) =>
        Promise.resolve(''),
    };
  } else {
    return null;
  }

  for (let i = 1; i < segments.length; i++) {
    if (
      !current ||
      (typeof current !== 'object' && typeof current !== 'function')
    ) {
      return null;
    }
    const prop = segments[i];
    if (!prop) {
      continue;
    }

    try {
      current = (current as Record<string, unknown>)[prop];
    } catch {
      return null;
    }
  }

  return current;
}

export function ejsCompletionSource(plugin: AllInOneToolkitPlugin) {
  return (context: CompletionContext): CompletionResult | null => {
    if (!plugin.settings.ejsEnabled) {
      return null;
    }

    if (!isEJSTemplateFile(context.state, plugin.settings.ejsTemplatesFolder)) {
      return null;
    }

    const docText = context.state.doc.toString();
    if (!isInsideEJSTag(docText, context.pos)) {
      return null;
    }

    // Dot member access (e.g. `app.vault.` or `file.`)
    const memberMatch = context.matchBefore(
      /([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\.([\w$]*)/,
    );
    if (memberMatch) {
      const fullMatched = memberMatch.text;
      const lastDotIndex = fullMatched.lastIndexOf('.');
      const objectPath = fullMatched.slice(0, lastDotIndex);

      const segments = objectPath.split('.');
      const currentFile = context.state.field(editorInfoField, false)?.file;
      const targetObj = resolveRuntimeObject(segments, plugin, currentFile);

      if (targetObj) {
        const dynamicOptions = extractDynamicProperties(targetObj);
        return {
          from: memberMatch.from + lastDotIndex + 1,
          options: dynamicOptions,
          validFor: /^[\w$]*$/,
        };
      }
    }

    // Global identifier completions inside EJS block
    const word = context.matchBefore(/[\w$]+/);
    if (!word && !context.explicit) {
      return null;
    }

    return {
      from: word ? word.from : context.pos,
      options: CUSTOM_EJS_GLOBALS,
    };
  };
}

export function createEJSAutocompleteExtension(
  plugin: AllInOneToolkitPlugin,
): Extension {
  return autocompletion({
    override: [ejsCompletionSource(plugin)],
  });
}
