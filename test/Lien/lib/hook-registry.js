import { METHODS } from "node:http";
import { pathToRegexp } from "path-to-regexp";
import Hooks from "./hooks.js";

/**
 * @typedef {Object<string, Object<string, Array<{re: RegExp, trans: Hooks}>>>} HookRegistry
 * Hook definitions indexed by type and lowercase HTTP method.
 * @private
 */

/**
 * HTTP method names used to register the public shortcuts.
 *
 * @type {Array<string>}
 * @private
 */
export const methods = [...new Set(METHODS.map(method => method.toLowerCase()))];
/**
 * Converts Lien's legacy route syntax to path-to-regexp 9 syntax.
 *
 * @param {import("./server.js").RoutePattern} url The pattern to normalize.
 * @returns {import("./server.js").RoutePattern}
 * @private
 */
export function normalizePattern (url) {
    if (Array.isArray(url)) {
        return url.map(normalizePattern);
    }
    if (typeof url !== "string") {
        return url;
    }
    return url
        .replace(/\/:([\w$]+)\?/g, "{/:$1}")
        .replace(/\/:([\w$]+)\+/g, "/*$1")
        .replace(/\/:([\w$]+)\*/g, "{/*$1}");
}

/**
 * Compiles custom parameter expressions, which path-to-regexp 9 no longer parses.
 *
 * @param {string} pattern The legacy pattern.
 * @returns {{regexp: RegExp, keys: Array<{name: string}>}} The matcher and capture names.
 * @private
 */
function compileCustomPattern (pattern) {
    const keys = [];
    let source = "^";
    const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (let index = 0; index < pattern.length;) {
        if (pattern.startsWith("(.*)", index)) {
            source += "(.*)";
            keys.push({ name: keys.length });
            index += 4;
            continue;
        }
        if (pattern[index] !== ":" || !/[\w$]/.test(pattern[index + 1] ?? "")) {
            source += escape(pattern[index++]);
            continue;
        }
        let end = index + 1;
        while (/[\w$]/.test(pattern[end] ?? "")) {
            end++;
        }
        const name = pattern.slice(index + 1, end);
        let expression = "[^/]+?";
        if (pattern[end] === "(") {
            const start = ++end;
            let depth = 1;
            while (end < pattern.length && depth) {
                if (pattern[end] === "\\") {
                    end += 2;
                    continue;
                }
                if (pattern[end] === "(") depth++;
                if (pattern[end] === ")") depth--;
                end++;
            }
            if (depth) {
                throw new TypeError(`Unclosed parameter expression in route: ${pattern}`);
            }
            expression = pattern.slice(start, end - 1);
        }
        const modifier = /[?+*]/.test(pattern[end] ?? "") ? pattern[end++] : "";
        const prefix = source.endsWith("/") ? "/" : source.endsWith("\\.") ? "\\." : "";
        if (prefix) {
            source = source.slice(0, -prefix.length);
        }
        if (modifier === "?") {
            source += `(?:${prefix}(${expression}))?`;
        } else if (modifier === "+" || modifier === "*") {
            const separator = prefix || "/";
            const repeated = `(${expression}(?:${separator}${expression})*)`;
            source += modifier === "+" ? `${prefix}${repeated}` : `(?:${prefix}${repeated})?`;
        } else {
            source += `${prefix}(${expression})`;
        }
        keys.push({ name });
        index = end;
    }
    return { regexp: new RegExp(`${source}(?:/)?$`, "i"), keys };
}

/** Counts capture groups while ignoring escaped parentheses and character classes. */
function countCaptures (regexp) {
    let count = 0;
    let inClass = false;
    const source = regexp.source;
    for (let index = 0; index < source.length; index++) {
        if (source[index] === "\\") {
            index++;
        } else if (source[index] === "[") {
            inClass = true;
        } else if (source[index] === "]") {
            inClass = false;
        } else if (!inClass && source[index] === "(" &&
            (source[index + 1] !== "?" ||
                (source[index + 2] === "<" && !/[=!]/.test(source[index + 3] ?? "")))) {
            count++;
        }
    }
    return count;
}

/**
 * Compiles strings, regular expressions, and mixed pattern arrays.
 *
 * @param {import("./server.js").RoutePattern} url The route pattern.
 * @returns {{regexp: RegExp, keys: Array<{name: string}>}} The matcher and capture names.
 * @private
 */
function compilePattern (url) {
    if (Array.isArray(url)) {
        const parts = url.map(compilePattern);
        return {
            regexp: new RegExp(parts.map(({ regexp }) => `(?:${regexp.source})`).join("|"), "i"),
            keys: parts.flatMap(({ keys, regexp, rawRegExp }) => rawRegExp
                ? Array.from({ length: countCaptures(regexp) }, (_, index) => ({ name: index, rawRegExp: true }))
                : keys)
        };
    }
    if (url instanceof RegExp) {
        return { regexp: url, keys: [], rawRegExp: true };
    }
    if (url === "*" || url === "(.*)") {
        return { regexp: /^(.*)(?:\/)?$/i, keys: [{ name: 0 }] };
    }
    if (/:([\w$]+)\(|\(\.\*\)/.test(url)) {
        return compileCustomPattern(url);
    }
    return pathToRegexp(normalizePattern(url));
}

/**
 * Compiles a legacy Lien pattern for Express 5 and restores named parameters.
 *
 * @param {import("./server.js").RoutePattern} url The route pattern.
 * @returns {{regexp: RegExp, restoreParams: Function}} The matcher and parameter middleware.
 * @private
 */
export function compileRoute (url) {
    const { regexp, keys } = compilePattern(url);
    const restoreParams = (req, res, next) => {
        const captures = req.params;
        req.params = keys.length ? Object.fromEntries(keys.flatMap((key, index) => {
            const value = key.rawRegExp ? captures[index] : captures[key.name] ?? captures[index];
            return value === undefined ? [] : [
                [key.name, value]
            ];
        })) : captures;
        next();
    };
    return { regexp, restoreParams };
}

/**
 * Selects registered pipelines by request path or by identical compiled pattern.
 *
 * @param {HookRegistry} registry The hook definitions.
 * @param {string} type The hook type.
 * @param {string|import("./server.js").RoutePattern} url The request path or registered pattern.
 * @param {string} method The lowercase HTTP method.
 * @param {boolean} [strict=false] Whether to compare compiled patterns.
 * @returns {Hooks|null} The selected pipeline, or null.
 * @private
 */
export function getHooks (registry, type, url, method, strict = false) {
    const pattern = strict ? compilePattern(url).regexp.toString() : null;
    const matching = (registry[type]?.[method] ?? []).filter(({ re }) => {
        re.lastIndex = 0;
        return strict ? re.toString() === pattern : re.test(url);
    }).map(({ trans }) => trans);
    if (!matching.length) {
        return null;
    }
    return matching.length === 1 ? matching[0] : new Hooks().add(matching, Hooks.PARALLEL);
}

/**
 * Stores a native pipeline under its type, method, and compiled pattern.
 *
 * @param {HookRegistry} registry The hook definitions.
 * @param {string} type The hook type.
 * @param {import("./server.js").RoutePattern} url The registered pattern.
 * @param {string} method The lowercase HTTP method.
 * @param {Hooks} pipeline The pipeline to register.
 * @returns {Hooks} The inserted pipeline.
 * @throws {TypeError} If the pipeline is not native.
 * @private
 */
export function insertHook (registry, type, url, method, pipeline) {
    if (!(pipeline instanceof Hooks)) {
        throw new TypeError("insertHook expects a Lien.Hooks pipeline. Register external callbacks with .add().");
    }
    const group = registry[type] ??= Object.create(null);
    const hooks = group[method] ??= [];
    hooks.push({
        re: compilePattern(url).regexp,
        trans: pipeline
    });
    return pipeline;
}
