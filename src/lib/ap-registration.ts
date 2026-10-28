/**
 * Andhra Pradesh Vehicle Registration Utilities
 * Normalizes and validates Indian & Andhra Pradesh vehicle registration numbers.
 */

// Known AP RTO District codes (comprehensive list including legacy and new AP codes)
export const KNOWN_AP_RTO_CODES: Record<string, string> = {
  '02': 'Anantapur',
  '03': 'Chittoor',
  '04': 'Kadapa',
  '05': 'Kakinada',
  '07': 'Guntur',
  '09': 'Hyderabad (Legacy AP)',
  '16': 'Vijayawada (Krishna District)',
  '21': 'Kurnool',
  '26': 'Nellore',
  '31': 'Visakhapatnam',
  '37': 'Eluru',
  '38': 'West Godavari',
  '39': 'Amaravati / State Capital Region (APSRTC & Institutional Hub)',
  '40': 'Tirupati',
};

export interface RegistrationValidationResult {
  isValid: boolean;
  normalized: string;
  formatted: string;
  stateCode: string;
  rtoCode: string;
  series: string;
  uniqueDigits: string;
  rtoLocation?: string;
  errorMessage?: string;
}

/**
 * Normalizes any registration string by stripping whitespace, hyphens, dots,
 * and converting to uppercase.
 * Example: "ap 39 ab 1234" -> "AP39AB1234"
 * Example: "AP-39-TL-1001" -> "AP39TL1001"
 */
export function normalizeApRegistration(input: string): string {
  if (!input) return '';
  return input.replace(/[\s\-_.]+/g, '').toUpperCase().trim();
}

/**
 * Formats a normalized registration into standard Indian display format.
 * Example: "AP39AB1234" -> "AP 39 AB 1234"
 */
export function formatApRegistration(normalized: string): string {
  const norm = normalizeApRegistration(normalized);
  const match = norm.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/);
  if (!match) return norm;
  const [, state, rto, series, digits] = match;
  return `${state} ${rto} ${series} ${digits}`;
}

/**
 * Validates vehicle registration according to MoRTH and AP transport standards.
 * Supports standard formats (e.g. AP39TL1001), vintage/legacy formats, and admin override.
 */
export function validateApRegistration(
  input: string,
  allowAnyIndianState = false,
  adminOverride = false
): RegistrationValidationResult {
  const normalized = normalizeApRegistration(input);

  if (!normalized) {
    return {
      isValid: false,
      normalized: '',
      formatted: '',
      stateCode: '',
      rtoCode: '',
      series: '',
      uniqueDigits: '',
      errorMessage: 'Registration number cannot be empty.',
    };
  }

  if (adminOverride) {
    return {
      isValid: true,
      normalized,
      formatted: formatApRegistration(normalized),
      stateCode: normalized.slice(0, 2),
      rtoCode: normalized.slice(2, 4),
      series: '',
      uniqueDigits: '',
      rtoLocation: 'Administrator Approved Exception',
    };
  }

  // Standard Indian Vehicle Reg Regex:
  // 2 State Letters + 2 Digits RTO + 1-3 Alpha Series + 4 Digits Unique Number
  // E.g. AP 39 TL 1001, AP 16 Z 9999, TS 07 UA 1234
  const standardPattern = /^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/;
  const match = normalized.match(standardPattern);

  if (!match) {
    return {
      isValid: false,
      normalized,
      formatted: normalized,
      stateCode: '',
      rtoCode: '',
      series: '',
      uniqueDigits: '',
      errorMessage:
        'Invalid registration format. Expected standard Indian registration such as AP39TL1001 or AP 39 AB 1234.',
    };
  }

  const [, stateCode, rtoCode, series, uniqueDigits] = match;

  if (!allowAnyIndianState && stateCode !== 'AP') {
    return {
      isValid: false,
      normalized,
      formatted: formatApRegistration(normalized),
      stateCode,
      rtoCode,
      series,
      uniqueDigits,
      errorMessage: `Vehicle registered in state "${stateCode}". Expected Andhra Pradesh ("AP") registration code.`,
    };
  }

  const rtoLocation = KNOWN_AP_RTO_CODES[rtoCode] || `AP RTO District ${rtoCode}`;

  return {
    isValid: true,
    normalized,
    formatted: `${stateCode} ${rtoCode} ${series} ${uniqueDigits}`,
    stateCode,
    rtoCode,
    series,
    uniqueDigits,
    rtoLocation,
  };
}
