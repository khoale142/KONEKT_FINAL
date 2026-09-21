import { ApiError } from '../../utils/ApiError.js';

const DECIMAL = /^-?(?:\d+|\d*\.\d+)$/;

function parsed(value, fieldName = 'Value') {
  const text = String(value ?? '').trim();
  if (!DECIMAL.test(text)) throw new ApiError(400, `${fieldName} must be a decimal number.`);
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');
  return { integer: (negative ? -1n : 1n) * BigInt(`${whole || '0'}${fraction}`), scale: fraction.length };
}

function align(a, b) {
  const scale = Math.max(a.scale, b.scale);
  return [a.integer * (10n ** BigInt(scale - a.scale)), b.integer * (10n ** BigInt(scale - b.scale)), scale];
}

function print(integer, scale) {
  const negative = integer < 0n;
  const digits = (negative ? -integer : integer).toString().padStart(scale + 1, '0');
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, '') : '';
  return `${negative ? '-' : ''}${whole || '0'}${fraction ? `.${fraction}` : ''}`;
}

export function decimal(value, fieldName) {
  const valueParsed = parsed(value, fieldName);
  return print(valueParsed.integer, valueParsed.scale);
}

export function compareDecimal(a, b) {
  const [left, right] = align(parsed(a), parsed(b));
  return left === right ? 0 : left > right ? 1 : -1;
}

export function addDecimal(a, b) {
  const [left, right, scale] = align(parsed(a), parsed(b));
  return print(left + right, scale);
}

export function subtractDecimal(a, b) {
  const [left, right, scale] = align(parsed(a), parsed(b));
  return print(left - right, scale);
}

export function multiplyDecimal(a, b) {
  const left = parsed(a); const right = parsed(b);
  return print(left.integer * right.integer, left.scale + right.scale);
}

// PostgreSQL NUMERIC is exact; a division may be non-terminating. Keep a deterministic,
// high precision decimal suitable for the NUMERIC cache and future receipt snapshots.
export function divideDecimal(a, b, precision = 12) {
  const left = parsed(a); const right = parsed(b);
  if (right.integer === 0n) throw new ApiError(400, 'Division by zero is invalid.');
  const numerator = left.integer * (10n ** BigInt(right.scale + precision));
  const denominator = right.integer * (10n ** BigInt(left.scale));
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder !== 0n && (remainder < 0n ? -remainder : remainder) * 2n >= (denominator < 0n ? -denominator : denominator)) {
    quotient += quotient >= 0n ? 1n : -1n;
  }
  return print(quotient, precision);
}

export function requirePositiveDecimal(value, fieldName) {
  const normalized = decimal(value, fieldName);
  if (compareDecimal(normalized, '0') <= 0) throw new ApiError(400, `${fieldName} must be greater than zero.`);
  return normalized;
}

export function requireNonNegativeDecimal(value, fieldName) {
  const normalized = decimal(value, fieldName);
  if (compareDecimal(normalized, '0') < 0) throw new ApiError(400, `${fieldName} cannot be negative.`);
  return normalized;
}
