import { editorInfoField, moment, normalizePath } from 'obsidian';
import type { Extension, EditorState } from '@codemirror/state';
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import type AllInOneToolkitPlugin from '../main';

/**
 * Checks whether the current editor state is editing a markdown file (*.md)
 * inside the configured EJS templates folder.
 */
export function isEJSTemplateFile(
  state: EditorState,
  templatesFolder: string,
): boolean {
  const file = state.field(editorInfoField, false)?.file;
  if (!file || file.extension.toLowerCase() !== 'md') {
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

  const normalizedFilePath = normalizePath(file.path).toLowerCase();
  const normalizedFolderPath = normalizedFolder.toLowerCase();

  return normalizedFilePath.startsWith(`${normalizedFolderPath}/`);
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
    info: 'Moment.js 인스턴스 및 날짜/시간 포맷팅 유틸리티',
  },
  {
    label: 'prompt',
    type: 'function',
    detail: '(msg: string, default?: string) => Promise<string>',
    info: '사용자 텍스트 입력 대화상자를 열고 입력값을 반환합니다.',
  },
  {
    label: 'select',
    type: 'function',
    detail:
      '(msg: string, items: string[], values?: string[]) => Promise<string>',
    info: '사용자 선택(Fuzzy Suggest) 대화상자를 열고 선택된 값을 반환합니다.',
  },
];

/**
 * Dynamically inspects an object and its prototype chain to extract all properties and methods.
 */
function extractDynamicProperties(target: unknown): Completion[] {
  if (target === null || target === undefined) {
    return [];
  }

  const propSet = new Set<string>();
  let current: unknown = target;

  // Traverse prototype chain up to 4 levels
  for (
    let depth = 0;
    depth < 4 && current && current !== Object.prototype;
    depth++
  ) {
    const keys =
      typeof current === 'object' || typeof current === 'function'
        ? Object.getOwnPropertyNames(current)
        : [];

    for (const key of keys) {
      if (
        key !== 'constructor' &&
        !key.startsWith('__') &&
        !key.startsWith('_')
      ) {
        propSet.add(key);
      }
    }

    current = Object.getPrototypeOf(current);
  }

  return Array.from(propSet)
    .sort()
    .map((key) => {
      let type: 'property' | 'function' = 'property';
      try {
        const val = (target as Record<string, unknown>)[key];
        if (typeof val === 'function') {
          type = 'function';
        }
      } catch {
        // Ignore getter evaluation exceptions
      }

      return {
        label: key,
        type,
      };
    });
}

/**
 * Resolves dot-separated access path (e.g. ['app', 'vault']) to the runtime instance.
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
    current = moment;
  } else {
    return null;
  }

  for (let i = 1; i < segments.length; i++) {
    if (!current || typeof current !== 'object') {
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
