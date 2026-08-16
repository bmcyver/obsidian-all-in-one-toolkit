import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  ViewPlugin,
  Decoration,
  type DecorationSet,
  type ViewUpdate,
  type EditorView,
  type PluginValue,
} from '@codemirror/view';
import type AllInOneToolkitPlugin from '../../main';
import { isEJSTemplateFile } from './autocomplete';

declare global {
  interface Window {
    Prism?: {
      languages: Record<string, unknown>;
      tokenize: (text: string, grammar: unknown) => Array<string | PrismToken>;
    };
  }
}

interface PrismToken {
  type: string;
  content: string | Array<string | PrismToken>;
  length?: number;
}

interface HighlightToken {
  from: number;
  to: number;
  className: string;
}

function getPrismTokenLength(token: PrismToken): number {
  if (typeof token.content === 'string') {
    return token.content.length;
  }
  if (Array.isArray(token.content)) {
    return token.content.reduce((acc, t) => {
      return acc + (typeof t === 'string' ? t.length : getPrismTokenLength(t));
    }, 0);
  }
  return token.length || 0;
}

function extractPrismTokens(
  tokens: Array<string | PrismToken>,
  offset: number,
  result: HighlightToken[],
): number {
  let currentOffset = offset;

  for (const token of tokens) {
    if (typeof token === 'string') {
      currentOffset += token.length;
    } else {
      const from = currentOffset;
      const length = getPrismTokenLength(token);
      const to = from + length;

      if (from < to) {
        result.push({
          from,
          to,
          className: `token ${token.type} cm-${token.type}`,
        });
      }

      currentOffset += length;
    }
  }

  return currentOffset;
}

const EJS_BLOCK_REGEX = /(<%(?:=|-|_|#)?)([\s\S]*?)((?:_|-)?%>)/g;

class EJSHighlightViewPlugin implements PluginValue {
  decorations: DecorationSet;
  private plugin: AllInOneToolkitPlugin;

  constructor(view: EditorView, plugin: AllInOneToolkitPlugin) {
    this.plugin = plugin;
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  private buildDecorations(view: EditorView): DecorationSet {
    if (
      !this.plugin.settings.ejsEnabled ||
      !isEJSTemplateFile(view.state, this.plugin.settings.ejsTemplatesFolder)
    ) {
      return Decoration.none;
    }

    const builder = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc;
    const { from: vpFrom, to: vpTo } = view.viewport;

    // Scan doc around viewport range
    const scanFrom = Math.max(0, vpFrom - 3000);
    const scanTo = Math.min(doc.length, vpTo + 3000);
    const scanText = doc.sliceString(scanFrom, scanTo);

    const prism = window.Prism;
    const jsGrammar = prism?.languages?.javascript || prism?.languages?.js;

    EJS_BLOCK_REGEX.lastIndex = 0;
    const markTokens: HighlightToken[] = [];
    const codeblockLines = new Set<number>();

    let match: RegExpExecArray | null;
    while ((match = EJS_BLOCK_REGEX.exec(scanText)) !== null) {
      const openTag = match[1] || '';
      const bodyCode = match[2] || '';

      const matchStart = scanFrom + match.index;
      const openTagEnd = matchStart + openTag.length;
      const bodyEnd = openTagEnd + bodyCode.length;
      const matchEnd = matchStart + match[0].length;

      if (matchEnd < vpFrom || matchStart > vpTo) {
        continue;
      }

      const startLine = doc.lineAt(matchStart);
      const endLine = doc.lineAt(matchEnd);

      if (startLine.number !== endLine.number) {
        for (let l = startLine.number; l <= endLine.number; l++) {
          codeblockLines.add(doc.line(l).from);
        }
      } else {
        markTokens.push({
          from: matchStart,
          to: matchEnd,
          className: 'cm-ejs-inline-tag',
        });
      }

      // 1. EJS Opening delimiter
      markTokens.push({
        from: matchStart,
        to: openTagEnd,
        className: 'token punctuation cm-bracket cm-ejs-delimiter',
      });

      // 2. Inner JavaScript tokens via Obsidian Prism
      if (bodyCode.length > 0) {
        if (openTag === '<%#') {
          markTokens.push({
            from: openTagEnd,
            to: bodyEnd,
            className: 'token comment cm-comment',
          });
        } else if (prism && jsGrammar) {
          try {
            const prismTokens = prism.tokenize(bodyCode, jsGrammar);
            extractPrismTokens(prismTokens, openTagEnd, markTokens);
          } catch {
            // Ignore tokenization errors
          }
        }
      }

      // 3. EJS Closing delimiter
      markTokens.push({
        from: bodyEnd,
        to: matchEnd,
        className: 'token punctuation cm-bracket cm-ejs-delimiter',
      });
    }

    // Sort mark tokens
    markTokens.sort((a, b) => a.from - b.from || b.to - a.to);

    // Merge line and mark decorations in strict positional order
    const sortedLines = Array.from(codeblockLines).sort((a, b) => a - b);
    let lineIdx = 0;
    let lastMarkFrom = -1;
    let lastMarkTo = -1;

    for (const mark of markTokens) {
      while (
        lineIdx < sortedLines.length &&
        sortedLines[lineIdx]! <= mark.from
      ) {
        const linePos = sortedLines[lineIdx]!;
        builder.add(
          linePos,
          linePos,
          Decoration.line({
            class: 'cm-ejs-codeblock-line',
          }),
        );
        lineIdx++;
      }

      if (
        mark.from < mark.to &&
        mark.to <= doc.length &&
        (mark.from !== lastMarkFrom || mark.to !== lastMarkTo)
      ) {
        try {
          builder.add(
            mark.from,
            mark.to,
            Decoration.mark({
              class: mark.className,
            }),
          );
          lastMarkFrom = mark.from;
          lastMarkTo = mark.to;
        } catch {
          // Ignore nesting conflicts
        }
      }
    }

    while (lineIdx < sortedLines.length) {
      const linePos = sortedLines[lineIdx]!;
      builder.add(
        linePos,
        linePos,
        Decoration.line({
          class: 'cm-ejs-codeblock-line',
        }),
      );
      lineIdx++;
    }

    return builder.finish();
  }
}

export function createEJSHighlightExtension(
  plugin: AllInOneToolkitPlugin,
): Extension {
  return ViewPlugin.define((view) => new EJSHighlightViewPlugin(view, plugin), {
    decorations: (v) => v.decorations,
  });
}
