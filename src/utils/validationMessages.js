/**
 * Single source of truth for form validation messages + validators.
 *
 * Every validator returns '' when the value is fine, otherwise the message to show.
 * Messages follow one style everywhere:  "<Field> is required."  /  "Please enter a valid ...".
 * Keep the rules in sync with the Spring Boot request DTOs (see inputLimits.js).
 */

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/; // 10-digit Indian mobile (same as CreateEmployeeRequest)
export const USERNAME_REGEX = /^[A-Za-z0-9._-]+$/;
export const NAME_REGEX = /^[A-Za-z][A-Za-z .'-]*$/;

export const MESSAGES = {
  required: (label) => `${label} is required.`,
  invalid: (label) => `Please enter a valid ${label.toLowerCase()}.`,
  min: (label, n) => `${label} must be at least ${n} characters.`,
  max: (label, n) => `${label} must be at most ${n} characters.`,

  email: {
    required: 'Email is required.',
    invalid: 'Please enter a valid email address.',
    duplicate: 'This email is already registered.',
  },
  username: {
    required: 'Username is required.',
    invalid: 'Username can only contain letters, numbers, dot, underscore and hyphen.',
    duplicate: 'This username is already taken.',
  },
  phone: {
    required: 'Phone number is required.',
    invalid: 'Please enter a valid 10-digit mobile number.',
    duplicate: 'This phone number is already registered.',
  },
  password: {
    required: 'Password is required.',
    mismatch: 'Passwords do not match.',
  },
  date: {
    required: (label) => `${label} is required.`,
    invalid: (label) => `Please enter a valid ${label.toLowerCase()}.`,
    future: (label) => `${label} cannot be in the future.`,
    order: (from, to) => `${to} cannot be earlier than ${from}.`,
  },
  file: {
    required: (label = 'File') => `${label} is required.`,
    type: 'Only JPG and PNG files are allowed.',
    size: (mb) => `File must be ${mb} MB or smaller.`,
  },
};

const clean = (v) => (v == null ? '' : String(v).trim());

export function validateRequired(value, label) {
  return clean(value) ? '' : MESSAGES.required(label);
}

/** Dropdowns: the placeholder option has value "". */
export const validateSelect = validateRequired;

export function validateEmail(value, { label = 'Email', required = true } = {}) {
  const v = clean(value);
  if (!v) return required ? (label === 'Email' ? MESSAGES.email.required : MESSAGES.required(label)) : '';
  if (v.length > 100) return MESSAGES.max(label, 100);
  return EMAIL_REGEX.test(v) ? '' : MESSAGES.email.invalid; // covers missing @, missing domain, spaces
}

export function validateUsername(value, { label = 'Username', min = 3, max = 50 } = {}) {
  const v = clean(value);
  if (!v) return MESSAGES.required(label);
  if (v.length < min) return MESSAGES.min(label, min);
  if (v.length > max) return MESSAGES.max(label, max);
  return USERNAME_REGEX.test(v) ? '' : MESSAGES.username.invalid;
}

export function validatePassword(value, { label = 'Password', min = 6, max = 100 } = {}) {
  if (!value) return MESSAGES.required(label);
  if (value.length < min) return MESSAGES.min(label, min);
  if (value.length > max) return MESSAGES.max(label, max);
  return '';
}

export function validateConfirmPassword(password, confirm, label = 'Confirm password') {
  if (!confirm) return MESSAGES.required(label);
  return password === confirm ? '' : MESSAGES.password.mismatch;
}

export function validatePhone(value, { label = 'Phone number', required = true } = {}) {
  const v = clean(value);
  if (!v) return required ? MESSAGES.required(label) : '';
  return PHONE_REGEX.test(v) ? '' : MESSAGES.phone.invalid;
}

export function validateName(value, { label = 'Name', required = true, max = 50 } = {}) {
  const v = clean(value);
  if (!v) return required ? MESSAGES.required(label) : '';
  if (v.length > max) return MESSAGES.max(label, max);
  return NAME_REGEX.test(v) ? '' : MESSAGES.invalid(label);
}

export function validateDate(value, { label = 'Date', required = true, notFuture = false } = {}) {
  if (!value) return required ? MESSAGES.date.required(label) : '';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return MESSAGES.date.invalid(label);
  if (notFuture && d > new Date()) return MESSAGES.date.future(label);
  return '';
}

/**
 * Turns a server message into { field, message } so a duplicate can be shown under the right
 * input, in red, instead of a generic toast. Returns null when it is not a duplicate error.
 *
 * Matches the backend texts, e.g.
 *   "Email 'a@b.com' is already registered."   (AuthenticationServiceImpl)
 *   "Username 'anagha.k' is already taken."    (AuthenticationServiceImpl)
 *   "User Profile already exists. You can update it"  (EmployeeServiceImpl -> same email)
 *   "This email already exists."               (candidateService)
 */
export function mapServerError(serverMessage) {
  const m = String(serverMessage || '');
  if (/e-?mail/i.test(m) && /(already|exist|registered|taken|duplicate)/i.test(m)) {
    return { field: 'email', message: MESSAGES.email.duplicate };
  }
  if (/profile already exists/i.test(m)) return { field: 'email', message: MESSAGES.email.duplicate };
  if (/user ?name/i.test(m) && /(already|exist|taken|duplicate)/i.test(m)) {
    return { field: 'username', message: MESSAGES.username.duplicate };
  }
  if (/(phone|mobile)/i.test(m) && /(already|exist|registered|taken|duplicate)/i.test(m)) {
    return { field: 'phoneNumber', message: MESSAGES.phone.duplicate };
  }
  return null;
}