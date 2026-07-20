/*
 * EJS Embedded JavaScript templates
 * Copyright 2112 Matthew Eernisse (mde@fleegix.org)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// c62fe52896017c3c1c0a9b0167e5a71facefb7c5

'use strict';

import utils from './utils';

/**
 * @file Embedded JavaScript templating engine (Browser compatible light version).
 */

// Keyword used in code generation -- updated to 'var' in CJS build
const DECLARATION_KEYWORD = 'let';

const _DEFAULT_OPEN_DELIMITER = '<';
const _DEFAULT_CLOSE_DELIMITER = '>';
const _DEFAULT_DELIMITER = '%';
const _DEFAULT_LOCALS_NAME = 'locals';
const _REGEX_STRING = '(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)';
const _OPTS_PASSABLE_WITH_DATA = [
  'delimiter',
  'scope',
  'context',
  'debug',
  'compileDebug',
  '_with',
  'rmWhitespace',
  'strict',
  'filename',
  'async',
];
const _JS_IDENTIFIER = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export interface Options {
  debug?: boolean;
  compileDebug?: boolean;
  filename?: string;
  openDelimiter?: string;
  closeDelimiter?: string;
  delimiter?: string;
  strict?: boolean;
  context?: any;
  cache?: boolean;
  rmWhitespace?: boolean;
  localsName?: string;
  async?: boolean;
  destructuredLocals?: string[];
  legacyInclude?: boolean;
  escape?: (markup: any) => string;
  escapeFunction?: (markup: any) => string;
  scope?: any;
  _with?: boolean;
  unsafePrototypeLocals?: boolean;
  outputFunctionName?: string;
}

export interface Cache {
  set(key: string, val: any): void;
  get(key: string): any;
  remove(key: string): void;
  reset(): void;
}

export type TemplateFunction = (data?: Record<string, any>) => string;
export type AsyncTemplateFunction = (
  data?: Record<string, any>,
) => Promise<string>;

/**
 * Get the template from a string or a file, either compiled on-the-fly or
 * read from cache (if enabled), and cache the template if needed.
 */
function handleCache(
  options: Options,
  template?: string,
): TemplateFunction | AsyncTemplateFunction {
  let func;
  const filename = options.filename;
  const hasTemplate = arguments.length > 1;

  if (options.cache && filename) {
    func = ejs.cache.get(filename);
    if (func) {
      return func;
    }
  }

  if (!hasTemplate || template === undefined) {
    throw new Error('Template source must be provided in browser environment.');
  }

  func = ejs.compile(template, options);
  if (options.cache && filename) {
    ejs.cache.set(filename, func);
  }
  return func;
}

/**
 * Re-throw the given `err` in context to the `str` of ejs, `filename`, and
 * `lineno`.
 */
function rethrow(
  err: Error & { path?: string },
  str: string,
  flnm: string,
  lineno: number,
  esc: (markup: any) => string,
) {
  const lines = str.split('\n');
  const start = Math.max(lineno - 3, 0);
  const end = Math.min(lines.length, lineno + 3);
  const filename = esc(flnm);
  // Error context
  const context = lines
    .slice(start, end)
    .map(function (line, i) {
      const curr = i + start + 1;
      return (curr === lineno ? ' >> ' : '    ') + curr + '| ' + line;
    })
    .join('\n');

  // Alter exception message
  err.path = filename;
  err.message =
    (filename || 'ejs') + ':' + lineno + '\n' + context + '\n\n' + err.message;

  throw err;
}

function stripSemi(str: string) {
  return str.replace(/;(\s*$)/, '$1');
}

/**
 * EJS template class
 * @public
 */
export class Template {
  static modes = {
    EVAL: 'eval',
    ESCAPED: 'escaped',
    RAW: 'raw',
    COMMENT: 'comment',
    LITERAL: 'literal',
  } as const;

  templateText: string;
  mode: 'eval' | 'escaped' | 'raw' | 'comment' | 'literal' | null = null;
  truncate = false;
  currentLine = 1;
  source = '';
  opts: Options;
  regex: RegExp;

  constructor(text: string, optsParam?: Options) {
    const opts = utils.hasOwnOnlyObject(optsParam || {});
    const options = utils.createNullProtoObjWherePossible();
    this.templateText = text;

    options.escapeFunction =
      opts.escape || opts.escapeFunction || utils.escapeXML;
    options.compileDebug = opts.compileDebug !== false;
    options.debug = !!opts.debug;
    options.filename = opts.filename;
    options.openDelimiter =
      opts.openDelimiter || ejs.openDelimiter || _DEFAULT_OPEN_DELIMITER;
    options.closeDelimiter =
      opts.closeDelimiter || ejs.closeDelimiter || _DEFAULT_CLOSE_DELIMITER;
    options.delimiter = opts.delimiter || ejs.delimiter || _DEFAULT_DELIMITER;
    options.strict = opts.strict || false;
    options.context = opts.context;
    options.cache = opts.cache || false;
    options.rmWhitespace = opts.rmWhitespace;
    options.outputFunctionName = opts.outputFunctionName;
    options.localsName =
      opts.localsName || ejs.localsName || _DEFAULT_LOCALS_NAME;
    options.async = opts.async;
    options.destructuredLocals = opts.destructuredLocals;
    options.legacyInclude =
      typeof opts.legacyInclude !== 'undefined' ? !!opts.legacyInclude : true;
    options.unsafePrototypeLocals = !!opts.unsafePrototypeLocals;

    if (options.strict) {
      options._with = false;
    } else {
      options._with = typeof opts._with !== 'undefined' ? opts._with : true;
    }

    this.opts = options;

    this.regex = this.createRegex();
  }

  createRegex(): RegExp {
    let str = _REGEX_STRING;
    const delim = utils.escapeRegExpChars(this.opts.delimiter);
    const open = utils.escapeRegExpChars(this.opts.openDelimiter);
    const close = utils.escapeRegExpChars(this.opts.closeDelimiter);
    str = str.replace(/%/g, delim).replace(/</g, open).replace(/>/g, close);
    return new RegExp(str);
  }

  compile(): TemplateFunction | AsyncTemplateFunction {
    let src: string;
    let fn: any;
    const opts = this.opts;
    let prepended = '';
    let appended = '';
    const escapeFn = opts.escapeFunction!;
    let ctor: any;
    const sanitizedFilename = opts.filename
      ? JSON.stringify(opts.filename)
      : 'undefined';

    if (!this.source) {
      this.generateSource();
      prepended +=
        `  ${DECLARATION_KEYWORD} __output = "";\n` +
        '  function __append(s) { if (s !== undefined && s !== null) __output += s }\n';
      if (opts.outputFunctionName) {
        if (!_JS_IDENTIFIER.test(opts.outputFunctionName)) {
          throw new Error('outputFunctionName is not a valid JS identifier.');
        }
        prepended +=
          `  ${DECLARATION_KEYWORD} ` +
          opts.outputFunctionName +
          ' = __append;' +
          '\n';
      }
      if (opts.localsName && !_JS_IDENTIFIER.test(opts.localsName)) {
        throw new Error('localsName is not a valid JS identifier.');
      }
      if (opts.destructuredLocals && opts.destructuredLocals.length) {
        let destructuring =
          `  ${DECLARATION_KEYWORD} __locals = (` +
          opts.localsName +
          ' || {}),\n';
        for (let i = 0; i < opts.destructuredLocals.length; i++) {
          const name = opts.destructuredLocals[i]!;
          if (!_JS_IDENTIFIER.test(name)) {
            throw new Error(
              'destructuredLocals[' + i + '] is not a valid JS identifier.',
            );
          }
          if (i > 0) {
            destructuring += ',\n  ';
          }
          destructuring += name + ' = __locals.' + name;
        }
        prepended += destructuring + ';\n';
      }
      if (opts._with !== false) {
        prepended += '  with (' + opts.localsName + ' || {}) {' + '\n';
        appended += '  }' + '\n';
      }
      appended += '  return __output;' + '\n';
      this.source = prepended + this.source + appended;
    }

    if (opts.compileDebug) {
      src =
        `${DECLARATION_KEYWORD} __line = 1` +
        '\n' +
        '  , __lines = ' +
        JSON.stringify(this.templateText) +
        '\n' +
        '  , __filename = ' +
        sanitizedFilename +
        ';' +
        '\n' +
        'try {' +
        '\n' +
        this.source +
        '} catch (e) {' +
        '\n' +
        '  rethrow(e, __lines, __filename, __line, escapeFn);' +
        '\n' +
        '}' +
        '\n';
    } else {
      src = this.source;
    }

    if (opts.strict) {
      src = '"use strict";\n' + src;
    }
    if (opts.debug) {
      console.log(src);
    }
    if (opts.compileDebug && opts.filename) {
      src = src + '\n' + '//# sourceURL=' + sanitizedFilename + '\n';
    }

    try {
      if (opts.async) {
        // Have to use generated function for this, since in envs without support,
        // it breaks in parsing
        try {
          ctor = new Function('return (async function(){}).constructor;')();
        } catch (e) {
          if (e instanceof SyntaxError) {
            throw new Error('This environment does not support async/await');
          } else {
            throw e;
          }
        }
      } else {
        ctor = Function;
      }
      fn = new ctor(opts.localsName + ', escapeFn, include, rethrow', src);
    } catch (e: any) {
      // istanbul ignore else
      if (e instanceof SyntaxError) {
        if (opts.filename) {
          e.message += ' in ' + opts.filename;
        }
        e.message += ' while compiling ejs\n\n';
        e.message +=
          'If the above error is not helpful, you may want to try EJS-Lint:\n';
        e.message += 'https://github.com/RyanZim/EJS-Lint';
        if (!opts.async) {
          e.message += '\n';
          e.message +=
            'Or, if you meant to create an async function, pass `async: true` as an option.';
        }
      }
      throw e;
    }

    const returnedFn = function anonymous(data: any) {
      const includeMock = function () {
        throw new Error(
          'include() is not supported in the browser environment.',
        );
      };
      let locals;
      if (opts.unsafePrototypeLocals) {
        locals = data || utils.createNullProtoObjWherePossible();
      } else {
        locals = utils.shallowCopy(
          utils.createNullProtoObjWherePossible(),
          data,
        );
      }
      return fn.apply(opts.context, [locals, escapeFn, includeMock, rethrow]);
    };
    if (opts.filename && typeof Object.defineProperty === 'function') {
      const filename = opts.filename;
      const parts = filename.split(/[\\/]/);
      const lastPart = parts[parts.length - 1] || '';
      const dotIndex = lastPart.lastIndexOf('.');
      const basename =
        dotIndex !== -1 ? lastPart.substring(0, dotIndex) : lastPart;
      try {
        Object.defineProperty(returnedFn, 'name', {
          value: basename,
          writable: false,
          enumerable: false,
          configurable: true,
        });
      } catch (e) {
        /* ignore */
      }
    }
    return returnedFn;
  }

  generateSource(): void {
    const opts = this.opts;

    if (opts.rmWhitespace) {
      // Have to use two separate replace here as `^` and `$` operators don't
      // work well with `\r` and empty lines don't work well with the `m` flag.
      this.templateText = this.templateText
        .replace(/[\r\n]+/g, '\n')
        .replace(/^\s+|\s+$/gm, '');
    }

    const self = this;
    const d = this.opts.delimiter!;
    const o = this.opts.openDelimiter!;
    const c = this.opts.closeDelimiter!;

    // Slurp spaces and tabs before opening whitespace slurp tag and after closing whitespace slurp tag
    // Build the tags using custom delimiters: openDelimiter + delimiter + '_' and '_' + delimiter + closeDelimiter
    const openWhitespaceSlurpTag = utils.escapeRegExpChars(o + d + '_');
    const closeWhitespaceSlurpTag = utils.escapeRegExpChars('_' + d + c);
    const openWhitespaceSlurpReplacement = o + d + '_';
    const closeWhitespaceSlurpReplacement = '_' + d + c;
    this.templateText = this.templateText
      .replace(
        new RegExp('[ \\t]*' + openWhitespaceSlurpTag, 'gm'),
        openWhitespaceSlurpReplacement,
      )
      .replace(
        new RegExp(closeWhitespaceSlurpTag + '[ \\t]*', 'gm'),
        closeWhitespaceSlurpReplacement,
      );

    const matches = this.parseTemplateText();

    if (matches && matches.length) {
      matches.forEach(function (line, index) {
        let closing;
        // If this is an opening tag, check for closing tags
        // FIXME: May end up with some false positives here
        // Better to store modes as k/v with openDelimiter + delimiter as key
        // Then this can simply check against the map
        if (
          line.indexOf(o + d) === 0 && // If it is a tag
          line.indexOf(o + d + d) !== 0
        ) {
          // and is not escaped
          closing = matches[index + 2];
          if (!(
            closing === d + c ||
            closing === '-' + d + c ||
            closing === '_' + d + c
          )) {
            throw new Error(
              'Could not find matching close tag for "' + line + '".',
            );
          }
        }
        self.scanLine(line);
      });
    }
  }

  parseTemplateText(): string[] {
    let str = this.templateText;
    const pat = this.regex;
    let result = pat.exec(str);
    const arr: string[] = [];
    let firstPos;

    while (result) {
      firstPos = result.index;

      if (firstPos !== 0) {
        arr.push(str.substring(0, firstPos));
        str = str.slice(firstPos);
      }

      arr.push(result[0]!);
      str = str.slice(result[0]!.length);
      result = pat.exec(str);
    }

    if (str) {
      arr.push(str);
    }

    return arr;
  }

  _addOutput(line: string): string | void {
    if (this.truncate) {
      // Only replace single leading linebreak in the line after
      // -%> tag -- this is the single, trailing linebreak
      // after the tag that the truncation mode replaces
      // Handle Win / Unix / old Mac linebreaks -- do the \r\n
      // combo first in the regex-or
      line = line.replace(/^(?:\r\n|\r|\n)/, '');
      this.truncate = false;
    }
    if (!line) {
      return line;
    }

    // Preserve literal slashes
    line = line.replace(/\\/g, '\\\\');

    // Convert linebreaks
    line = line.replace(/\n/g, '\\n');
    line = line.replace(/\r/g, '\\r');

    // Escape double-quotes
    // - this will be the delimiter during execution
    line = line.replace(/"/g, '\\"');
    this.source += '    ; __append("' + line + '")' + '\n';
  }

  scanLine(line: string): void {
    const self = this;
    const d = this.opts.delimiter!;
    const o = this.opts.openDelimiter!;
    const c = this.opts.closeDelimiter!;
    let newLineCount = 0;

    newLineCount = line.split('\n').length - 1;

    switch (line) {
      case o + d:
      case o + d + '_':
        this.mode = Template.modes.EVAL;
        break;
      case o + d + '=':
        this.mode = Template.modes.ESCAPED;
        break;
      case o + d + '-':
        this.mode = Template.modes.RAW;
        break;
      case o + d + '#':
        this.mode = Template.modes.COMMENT;
        break;
      case o + d + d:
        this.mode = Template.modes.LITERAL;
        this.source +=
          '    ; __append("' + line.replace(o + d + d, o + d) + '")' + '\n';
        break;
      case d + d + c:
        this.mode = Template.modes.LITERAL;
        this.source +=
          '    ; __append("' + line.replace(d + d + c, d + c) + '")' + '\n';
        break;
      case d + c:
      case '-' + d + c:
      case '_' + d + c:
        if (this.mode === Template.modes.LITERAL) {
          this._addOutput(line);
        }

        this.mode = null;
        this.truncate = line.indexOf('-') === 0 || line.indexOf('_') === 0;
        break;
      default:
        // In script mode, depends on type of tag
        if (this.mode) {
          // If '//' is found without a line break, add a line break.
          switch (this.mode) {
            case Template.modes.EVAL:
            case Template.modes.ESCAPED:
            case Template.modes.RAW:
              if (line.lastIndexOf('//') > line.lastIndexOf('\n')) {
                line += '\n';
              }
          }
          switch (this.mode) {
            // Just executing code
            case Template.modes.EVAL:
              this.source += '    ; ' + line + '\n';
              break;
            // Exec, esc, and output
            case Template.modes.ESCAPED:
              this.source +=
                '    ; __append(escapeFn(' + stripSemi(line) + '))' + '\n';
              break;
            // Exec and output
            case Template.modes.RAW:
              this.source += '    ; __append(' + stripSemi(line) + ')' + '\n';
              break;
            case Template.modes.COMMENT:
              // Do nothing
              break;
            // Literal <%% mode, append as raw output
            case Template.modes.LITERAL:
              this._addOutput(line);
              break;
          }
        }
        // In string mode, just add the output
        else {
          this._addOutput(line);
        }
    }

    if (self.opts.compileDebug && newLineCount) {
      this.currentLine += newLineCount;
      this.source += '    ; __line = ' + this.currentLine + '\n';
    }
  }
}

// ----------------------------------------------------
// EjsEngine class implementation
// ----------------------------------------------------

export class EjsEngine {
  cache: Cache = utils.cache;
  localsName = _DEFAULT_LOCALS_NAME;
  promiseImpl = new Function('return this;')().Promise;

  openDelimiter?: string;
  closeDelimiter?: string;
  delimiter?: string;

  compile(
    template: string,
    opts: Options & { async: true },
  ): AsyncTemplateFunction;
  compile(
    template: string,
    opts?: Options & { async?: false },
  ): TemplateFunction;
  compile(
    template: string,
    opts?: Options,
  ): TemplateFunction | AsyncTemplateFunction;
  compile(
    template: string,
    opts?: Options,
  ): TemplateFunction | AsyncTemplateFunction {
    if (opts && opts.scope) {
      console.warn(
        '`scope` option is deprecated and will be removed in future EJS',
      );
      if (!opts.context) {
        opts.context = opts.scope;
      }
      delete opts.scope;
    }
    const templ = new Template(template, opts);
    return templ.compile();
  }

  render(
    template: string,
    data: Record<string, any> | undefined,
    opts: Options & { async: true },
  ): Promise<string>;
  render(
    template: string,
    data?: Record<string, any>,
    opts?: Options & { async?: false },
  ): string;
  render(
    template: string,
    data?: Record<string, any>,
    opts?: Options,
  ): string | Promise<string>;
  render(
    template: string,
    d?: Record<string, any>,
    o?: Options,
  ): string | Promise<string> {
    const data = d || utils.createNullProtoObjWherePossible();
    const opts = o || utils.createNullProtoObjWherePossible();

    if (arguments.length === 2) {
      utils.shallowCopyFromList(opts, data, _OPTS_PASSABLE_WITH_DATA);
    }

    return handleCache(opts, template)(data);
  }

  Template = Template;

  clearCache(): void {
    this.cache.reset();
  }

  escapeXML = utils.escapeXML;
}

const ejs = new EjsEngine();

/* istanbul ignore if */
// if (typeof window !== 'undefined') {
//   (window as any).ejs = ejs;
// }

export default ejs;
