/**
 * Global replacement for the browser's generic "Please fill out this field." bubble.
 *
 * It turns every native HTML5 validation message in the app into a field-specific one,
 * e.g. "Email is mandatory.", "Temporary Password is mandatory.", "Please enter a valid email address."
 *
 * The field name is read automatically from the field's label, so any existing or future
 * <input/select/textarea required> works without extra code. To override the name for one
 * field, add data-label="Work Email" to it.
 *
 * Call installFormValidationMessages() once at app start (see main.jsx).
 */

const AUTO_FLAG = 'data-auto-validity';
const MAX_LABEL_LENGTH = 40;
const IGNORED_IN_LABEL = 'input, select, textarea, svg, button, option, small, .field-error, [role="alert"]';

// Turn a label-ish element into clean text ("Email *" -> "Email").
const cleanLabelText = (node) => {
  if (!node) return '';
  const clone = node.cloneNode(true);
  clone.querySelectorAll(IGNORED_IN_LABEL).forEach((n) => n.remove());
  return (clone.textContent || '')
    .replace(/\(optional\)/gi, '')
    .replace(/[*:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const isUsable = (text) => Boolean(text) && text.length <= MAX_LABEL_LENGTH;

const getFieldLabel = (el) => {
  // 1. Explicit override
  const explicit = el.getAttribute('data-label');
  if (isUsable(explicit)) return explicit.trim();

  // 2. <label for="..."> or a wrapping <label>
  if (el.labels && el.labels.length) {
    const text = cleanLabelText(el.labels[0]);
    if (isUsable(text)) return text;
  }

  // 3. A label-like element next to the field, e.g. <div><span class="ev-label">Title</span><input/></div>
  let container = el.parentElement;
  for (let depth = 0; container && depth < 3; depth += 1, container = container.parentElement) {
    // Only trust a container that wraps this one field, so we never pick up another field's label.
    if (container.querySelectorAll('input, select, textarea').length !== 1) break;
    const candidate = Array.from(container.children).find(
      (child) =>
        !child.contains(el) &&
        (child.matches('label, legend') || /label/i.test(child.getAttribute('class') || ''))
    );
    if (candidate) {
      const text = cleanLabelText(candidate);
      if (isUsable(text)) return text;
    }
  }

  // 4. aria-label, placeholder, name
  const aria = el.getAttribute('aria-label');
  if (isUsable(aria)) return aria.trim();
  const placeholder = el.getAttribute('placeholder');
  if (isUsable(placeholder)) return placeholder.trim();
  return el.getAttribute('name') || 'This field';
};

const buildMessage = (el) => {
  const { validity } = el;
  const label = getFieldLabel(el);

  if (validity.valueMissing) return `${label} is mandatory.`;

  if (validity.typeMismatch) {
    if (el.type === 'email') return 'Please enter a valid email address (e.g. name@company.com).';
    if (el.type === 'url') return 'Please enter a valid URL.';
    return `Please enter a valid ${label}.`;
  }
  if (validity.patternMismatch) return el.title || `Please enter a valid ${label}.`;
  if (validity.tooShort) return `${label} must be at least ${el.minLength} characters.`;
  if (validity.tooLong) return `${label} must be at most ${el.maxLength} characters.`;
  if (validity.rangeUnderflow) {
    return el.type === 'number'
      ? `${label} must be ${el.min} or more.`
      : `${label} cannot be earlier than ${el.min}.`;
  }
  if (validity.rangeOverflow) {
    return el.type === 'number'
      ? `${label} must be ${el.max} or less.`
      : `${label} cannot be later than ${el.max}.`;
  }
  if (validity.badInput || validity.stepMismatch) return `Please enter a valid ${label}.`;
  return '';
};

let installed = false;

export function installFormValidationMessages() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  // "invalid" does not bubble, so listen in the capture phase.
  document.addEventListener(
    'invalid',
    (event) => {
      const el = event.target;
      if (!el || typeof el.setCustomValidity !== 'function') return;
      // Respect a custom message set by app code.
      if (el.validity.customError && !el.hasAttribute(AUTO_FLAG)) return;

      const message = buildMessage(el);
      if (message) {
        el.setCustomValidity(message);
        el.setAttribute(AUTO_FLAG, 'true');
      }
    },
    true
  );

  // Clear our message as soon as the user edits the field, otherwise it would stay invalid.
  const clear = (event) => {
    const el = event.target;
    if (el && el.hasAttribute && el.hasAttribute(AUTO_FLAG)) {
      el.setCustomValidity('');
      el.removeAttribute(AUTO_FLAG);
    }
  };
  document.addEventListener('input', clear, true);
  document.addEventListener('change', clear, true);
}