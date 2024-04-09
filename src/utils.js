import path from 'node:path';

/**
 * Return whether `arg` is a string that contains path separators
 * @param {unknown} arg
 * @returns {arg is string}
 */
export function isPathLikeString(arg) {
  return typeof arg === 'string' && arg !== path.basename(arg);
}

/**
 * Checks if `value` is a plain object. An object is plain if it is created by either `{}`, `new Object()`, or `Object.create(null)`.
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) &&
    !(Symbol.toStringTag in value) &&
    !(Symbol.iterator in value)
  );
}

/**
 * Checks if `value` is a plain object containing only string values
 * @param {unknown} value
 * @returns {value is Record<string, string>}
 */
export function isStringRecord(value) {
  return isPlainObject(value) && Object.values(value).every((value) => typeof value === 'string');
}

/**
 * Return whether an object has the specified property
 * @template {Record<string, unknown>} T
 * @template {PropertyKey} K
 * @param {T} obj
 * @param {K} key
 * @returns {obj is T & { [P in K]: T[P] }}
 */
export function hasProperty(obj, key) {
  return Object.hasOwn(obj, key);
}
