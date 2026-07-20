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

/**
 * Private utility functions
 * @module utils
 * @private
 */

'use strict';

const regExpChars = /[|\\{}()[\]^$+*?.]/g;
const hasOwnProperty = Object.prototype.hasOwnProperty;

export function hasOwn(obj: any, key: string | number | symbol): boolean {
  return hasOwnProperty.call(obj, key);
}

/**
 * Escape characters reserved in regular expressions.
 *
 * If `string` is `undefined` or `null`, the empty string is returned.
 *
 * @param {String} string Input string
 * @return {String} Escaped string
 * @static
 * @private
 */
export function escapeRegExpChars(string: any): string {
  if (!string) {
    return '';
  }
  return String(string).replace(regExpChars, '\\$&');
}

const _ENCODE_HTML_RULES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&#34;',
  "'": '&#39;',
};
const _MATCH_HTML = /[&<>'"]/g;

function encode_char(c: string): string {
  return _ENCODE_HTML_RULES[c] || c;
}

/**
 * Stringified version of constants used by {@link module:utils.escapeXML}.
 *
 * @readonly
 * @type {String}
 */
const escapeFuncStr =
  'var _ENCODE_HTML_RULES = {\n' +
  '      "&": "&amp;"\n' +
  '    , "<": "&lt;"\n' +
  '    , ">": "&gt;"\n' +
  '    , \'"\': "&#34;"\n' +
  '    , "\'": "&#39;"\n' +
  '    }\n' +
  '  , _MATCH_HTML = /[&<>\'"]/g;\n' +
  'function encode_char(c) {\n' +
  '  return _ENCODE_HTML_RULES[c] || c;\n' +
  '};\n';

/**
 * Escape characters reserved in XML.
 *
 * If `markup` is `undefined` or `null`, the empty string is returned.
 *
 * @implements {EscapeCallback}
 * @param {String} markup Input string
 * @return {String} Escaped string
 * @static
 * @private
 */
export function escapeXML(markup: any): string {
  return markup == undefined
    ? ''
    : String(markup).replace(_MATCH_HTML, encode_char);
}

function escapeXMLToString(this: any) {
  return Function.prototype.toString.call(this) + ';\n' + escapeFuncStr;
}

try {
  if (typeof Object.defineProperty === 'function') {
    // If the Function prototype is frozen, the "toString" property is non-writable. This means that any objects which inherit this property
    // cannot have the property changed using an assignment. If using strict mode, attempting that will cause an error. If not using strict
    // mode, attempting that will be silently ignored.
    // However, we can still explicitly shadow the prototype's "toString" property by defining a new "toString" property on this object.
    Object.defineProperty(escapeXML, 'toString', { value: escapeXMLToString });
  } else {
    // If Object.defineProperty() doesn't exist, attempt to shadow this property using the assignment operator.
    (escapeXML as any).toString = escapeXMLToString;
  }
} catch (err) {
  console.warn(
    'Unable to set escapeXML.toString (is the Function prototype frozen?)',
  );
}

/**
 * Naive copy of properties from one object to another.
 * Does not recurse into non-scalar properties
 * Does not check to see if the property has a value before copying
 *
 * @param  {Object} to   Destination object
 * @param  {Object} from Source object
 * @return {Object}      Destination object
 * @static
 * @private
 */
export function shallowCopy<T extends object, U extends object>(
  to: T,
  from: U,
): T & U {
  const fromObj = (from || {}) as any;
  if (to !== null && to !== undefined) {
    for (const p in fromObj) {
      if (!hasOwn(fromObj, p)) {
        continue;
      }
      if (p === '__proto__' || p === 'constructor') {
        continue;
      }
      (to as any)[p] = fromObj[p];
    }
  }
  return to as T & U;
}

/**
 * Naive copy of a list of key names, from one object to another.
 * Only copies property if it is actually defined
 * Does not recurse into non-scalar properties
 *
 * @param  {Object} to   Destination object
 * @param  {Object} from Source object
 * @param  {Array} list List of properties to copy
 * @return {Object}      Destination object
 * @static
 * @private
 */
export function shallowCopyFromList(to: any, from: any, list: string[]): any {
  const listArr = list || [];
  const fromObj = from || {};
  if (to !== null && to !== undefined) {
    for (let i = 0; i < listArr.length; i++) {
      const p = listArr[i]!;
      if (typeof fromObj[p] !== 'undefined') {
        if (!hasOwn(fromObj, p)) {
          continue;
        }
        if (p === '__proto__' || p === 'constructor') {
          continue;
        }
        to[p] = fromObj[p];
      }
    }
  }
  return to;
}

export interface Cache {
  _data: Record<string, any>;
  set(key: string, val: any): void;
  get(key: string): any;
  remove(key: string): void;
  reset(): void;
}

/**
 * Simple in-process cache implementation. Does not implement limits of any
 * sort.
 *
 * @implements {Cache}
 * @static
 * @private
 */
export const cache: Cache = {
  _data: {},
  set(key, val) {
    this._data[key] = val;
  },
  get(key) {
    return this._data[key];
  },
  remove(key) {
    delete this._data[key];
  },
  reset() {
    this._data = {};
  },
};

/**
 * Transforms hyphen case variable into camel case.
 *
 * @param {String} string Hyphen case string
 * @return {String} Camel case string
 * @static
 * @private
 */
export function hyphenToCamel(str: string): string {
  return str.replace(/-[a-z]/g, (match) => match[1]!.toUpperCase());
}

/**
 * Returns a null-prototype object in runtimes that support it
 *
 * @return {Object} Object, prototype will be set to null where possible
 * @static
 * @private
 */
export const createNullProtoObjWherePossible: () => any = (function () {
  if (typeof Object.create === 'function') {
    return function () {
      return Object.create(null);
    };
  }
  if (!({ __proto__: null } instanceof Object)) {
    return function () {
      return { __proto__: null };
    };
  }
  // Not possible, just pass through
  return function () {
    return {};
  };
})();

/**
 * Copies own-properties from one object to a null-prototype object for basic
 * protection against prototype pollution
 *
 * @return {Object} Object with own-properties of input object
 * @static
 * @private
 */
export function hasOwnOnlyObject(obj: any): any {
  const o = createNullProtoObjWherePossible();
  for (const p in obj) {
    if (hasOwn(obj, p)) {
      o[p] = obj[p];
    }
  }
  return o;
}

const utils = {
  hasOwn,
  escapeRegExpChars,
  escapeXML,
  shallowCopy,
  shallowCopyFromList,
  cache,
  hyphenToCamel,
  createNullProtoObjWherePossible,
  hasOwnOnlyObject,
};

export default utils;
