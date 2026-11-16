/**
 * Property names excluded from session merges and lookups.
 *
 * @private
 * @type {Set<string>}
 */
const blockedKeys = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Merges session records recursively, ignoring undefined values and prototype keys.
 * Returns a new record; arrays and other non-record values replace the previous value.
 *
 * @param {object|null|undefined} base Existing values.
 * @param {object|null|undefined} update New values.
 * @returns {Object<string, *>} The merged record.
 * @private
 */
export function mergeData (base, update) {
    const result = {};
    for (const source of [base, update]) {
        if (!source || typeof source !== "object") {
            continue;
        }
        for (const [key, value] of Object.entries(source)) {
            if (blockedKeys.has(key) || value === undefined) {
                continue;
            }
            result[key] = isRecord(value) ? mergeData(result[key], value) : value;
        }
    }
    return result;
}

/**
 * Checks for a plain object or an object with a null prototype.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean}
 */
function isRecord (value) {
    return value !== null && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

/**
 * Reads an own-property path without traversing prototypes or losing falsy values.
 *
 * @param {object|null|undefined} object The source record.
 * @param {string} field The dot-separated path.
 * @returns {*} The value, or null when absent or blocked.
 * @private
 */
export function getData (object, field) {
    for (const key of field.replace(/\.$/, "").split(".")) {
        if (blockedKeys.has(key) || object == null || !Object.hasOwn(object, key)) {
            return null;
        }
        object = object[key];
    }
    return object ?? null;
}

/**
 * Keeps Error objects or wraps another failure value as the cause of a new Error.
 *
 * @param {*} value The failure reason.
 * @param {string} [message] The fallback message.
 * @returns {Error} The original or wrapped error.
 * @private
 */
export function asError (value, message = "Operation failed without an error.") {
    return value instanceof Error ? value : new Error(message, {
        cause: value
    });
}
