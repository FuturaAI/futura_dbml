/**
 * @file types.js — JSDoc type definitions for the DBML diagram
 * All @typedef here are globally visible to every other JS file in the project
 * (no import/export = script scope, picked up by jsconfig.json).
 */

// ── Domain types ──────────────────────────────────────────

/**
 * @typedef {Object} Column
 * @property {string}  name
 * @property {string}  type
 * @property {boolean} [pk]
 * @property {boolean} [fk]
 * @property {boolean} [not_null]
 * @property {boolean} [unique]
 * @property {string}  [note]
 */

/**
 * @typedef {Object} Table
 * @property {string}   name
 * @property {string}   full_name
 * @property {string}   [note]
 * @property {Column[]} columns
 */

/**
 * @typedef {Object} Ref
 * @property {string} from_table
 * @property {string} from_col
 * @property {string} to_table
 * @property {string} to_col
 * @property {string} [type]
 */

/**
 * @typedef {Object} Position
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {number} x
 * @property {number} y
 * @property {string} text
 * @property {string} color
 */

/**
 * @typedef {Object} Project
 * @property {number}                        id
 * @property {string}                        name
 * @property {Record<string, Table>}         tables
 * @property {Ref[]}                         refs
 * @property {Record<string, string[]>}      groups
 * @property {string[]}                      ungrouped
 * @property {Note[]}                        notes
 * @property {Record<string, Position>}      saved_positions
 * @property {any[]}                         [views]
 * @property {any[]}                         [doc_notes]
 * @property {Record<string, string>}        [table_notes]
 */

// ── Internal diagram types ────────────────────────────────

/**
 * @typedef {Object} HistoryEntry
 * @property {Record<string, Position>} positions
 * @property {Note[]}                   notes
 */

/**
 * @typedef {Object} NoteEntry
 * @property {HTMLElement} el
 * @property {Note}        data
 */

/**
 * @typedef {Object} MinimapState
 * @property {number} mmScale
 * @property {number} mmMinX
 * @property {number} mmMinY
 */
