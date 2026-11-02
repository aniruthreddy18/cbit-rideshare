import AppError from './AppError.js';

// Any normal email address (stored lowercase), e.g. name@gmail.com or roll@cbit.ac.in.
export const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
export const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

export const BOOKING_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'];
export const MAX_SEATS = 6;
export const MAX_PRICE_PER_SEAT = 5000;

/**
 * Read a string from untrusted input. Non-strings (objects such as {"$gt": ""})
 * become '' so they can never reach a MongoDB query as an operator.
 */
export function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Accepts 9876543210, +91 98765 43210, 91-9876543210 ... and returns 10 digits or null. */
export function normalizePhone(value) {
  const compact = (typeof value === 'string' || typeof value === 'number' ? String(value) : '').replace(/[\s()-]/g, '');
  const match = compact.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  return match ? match[1] : null;
}

export function isValidDateString(value) {
  if (!DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Rides happen in Hyderabad, so date + time are interpreted in IST (UTC+05:30). */
export function toDepartureDate(date, time) {
  return new Date(`${date}T${time}:00+05:30`);
}

/** Today's date in IST as YYYY-MM-DD. */
export function todayIST() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Parse a number from a string/number input. Returns NaN for anything else. */
export function num(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function assertObjectId(id, label = 'id') {
  if (typeof id !== 'string' || !OBJECT_ID_REGEX.test(id)) {
    throw new AppError(400, `Invalid ${label}.`);
  }
}

/** Throws a 400 with all field errors at once, so the form can highlight every problem. */
export function throwIfErrors(errors, message = 'Please fix the highlighted fields.') {
  if (Object.keys(errors).length) throw new AppError(400, message, errors);
}
