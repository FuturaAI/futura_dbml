/**
 * @file constants.js — shared constants, palette, icons, utilities
 */

/** @type {string[]} */
const GROUP_COLORS = [
  '#ef4444', '#3b82f6', '#a855f7', '#22c55e',
  '#f59e0b', '#06b6d4', '#f97316', '#ec4899',
];

/** @type {string[]} */
const NOTE_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa'];

/** @type {number} */ const CARD_WIDTH  = 260;
/** @type {number} */ const COL_ROW_H   = 26;
/** @type {number} */ const HEADER_H    = 44;
/** @type {number} */ const CARD_PAD_B  = 10;
/** @type {number} */ const COL_GAP     = 90;
/** @type {number} */ const ROW_GAP     = 36;
/** @type {number} */ const START_X     = 60;
/** @type {number} */ const START_Y     = 70;
/** @type {number} */ const GRP_PAD     = 24;
/** @type {number} */ const GRP_LABEL_H = 16;

/**
 * Convert a hex colour string to an rgba() value.
 * @param {string} hex - e.g. '#3b82f6'
 * @param {number} a   - alpha 0–1
 * @returns {string}
 */
function hexRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** @type {string} */
const SVG_EYE_OPEN   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;

/** @type {string} */
const SVG_EYE_CLOSED = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
