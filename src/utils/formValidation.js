/**
 * Global form validation helper (call installFormValidationMessages() once in main.jsx).
 *
 * 1. Replaces the browser's generic "Please fill out this field." bubble with a field-specific
 *    message, e.g. "Email is required." / "Please enter a valid email address."
 * 2. Puts a red * on the label of every mandatory field (any <input/select/textarea required>),
 *    so new and existing forms need no extra code. The star is drawn by styles/required-fields.css
 *    from the data-required="true" attribute this file sets on the label.
 *
 * The field name is read from the field's label. To override it for one field add
 * data-label="Work Email" to the input.
 */

const AUTO_FLAG = 'data-auto-validity';
const REQUIRED_ATTR = 'data-required';
const MAX_LABEL_LENGTH = 40;
const CONTROLS = 'input, select, textarea';
const IGNORED_IN_LABEL = 'input, select, textarea, svg, button, option, small, .field-error, .required-star, [role="alert"]';
const NO_STAR_TYPES = ['hidden', 'checkbox', 'radio', 'button', 'submit', 'reset', 'image'];

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const EMAIL_INVALID = 'Please enter a valid email address.';
const PHONE_INVALID = 'Please enter a valid 10-digit mobile number.';

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
const hasControl = (node) => node.matches(CONTROLS) || Boolean(node.querySelector(CONTROLS));

/**
 * Finds the element that visually holds the field's name (the "Email" text) so we can put the
 * star after it. Returns null when there is none.
 */
const findLabelElement = (el) => {
  // 1. <label for="..."> or a wrapping <label>
  const label = el.labels && el.labels[0];
  if (label) {
    if (label.querySelector('.required-star')) return null; // page already draws its own star

    // a child holding only the name, e.g. <span class="hrms-field__label">Email</span>
    const nameChild = Array.from(label.children).find(
      (child) => !hasControl(child) && !child.matches('svg, button, small') && cleanLabelText(child)
    );
    if (nameChild) return nameChild;

    // raw text directly inside the label, e.g. <label>Full Name<input/></label>: wrap the text node
    const textNode = Array.from(label.childNodes).find(
      (n) => n.nodeType === 3 && n.textContent.trim()
    );
    if (textNode) {
      const span = document.createElement('span');
      span.className = 'required-label';
      label.insertBefore(span, textNode);
      span.appendChild(textNode);
      return span;
    }
    return label.matches('[for]') ? label : null;
  }

  // 2. A label-like element next to the field, e.g. <div><span class="ev-label">Title</span><input/></div>
  let container = el.parentElement;
  for (let depth = 0; container && depth < 3; depth += 1, container = container.parentElement) {
    if (container.querySelectorAll(CONTROLS).length !== 1) break; // never borrow another field's label
    const candidate = Array.from(container.children).find(
      (child) =>
        !child.contains(el) &&
        (child.matches('label, legend') || /label/i.test(child.getAttribute('class') || ''))
    );
    if (candidate) return candidate;
  }
  return null;
};

const getFieldLabel = (el) => {
  const explicit = el.getAttribute('data-label');
  if (isUsable(explicit)) return explicit.trim();

  const target = findLabelElement(el);
  if (target) {
    const text = cleanLabelText(target);
    if (isUsable(text)) return text;
  }

  const aria = el.getAttribute('aria-label');
  if (isUsable(aria)) return aria.trim();
  const placeholder = el.getAttribute('placeholder');
  if (isUsable(placeholder)) return placeholder.trim();
  return el.getAttribute('name') || 'This field';
};

const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

const buildMessage = (el) => {
  const { validity } = el;
  const label = getFieldLabel(el);

  if (validity.valueMissing) return `${label} is required.`;

  if (validity.typeMismatch) {
    if (el.type === 'email') return EMAIL_INVALID;
    if (el.type === 'url') return 'Please enter a valid URL.';
    return `Please enter a valid ${lower(label)}.`;
  }
  if (validity.patternMismatch) {
    if (el.title) return el.title;
    if (/e-?mail/i.test(label)) return EMAIL_INVALID;
    if (/phone|mobile/i.test(label)) return PHONE_INVALID;
    return `Please enter a valid ${lower(label)}.`;
  }
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
  if (validity.badInput || validity.stepMismatch) return `Please enter a valid ${lower(label)}.`;
  return '';
};

/* ---------- red * on mandatory labels ---------- */

const syncRequiredMark = (el) => {
  if (!el || !el.matches || !el.matches(CONTROLS)) return;
  if (NO_STAR_TYPES.includes((el.getAttribute('type') || '').toLowerCase())) return;
  const target = findLabelElement(el);
  if (!target) return;
  if (el.required) target.setAttribute(REQUIRED_ATTR, 'true');
  else target.removeAttribute(REQUIRED_ATTR);
};

const syncTree = (root) => {
  if (!root || root.nodeType !== 1) return;
  if (root.matches(CONTROLS)) syncRequiredMark(root);
  root.querySelectorAll(CONTROLS).forEach(syncRequiredMark);
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
  // For email boxes also catch "a@b" / "a b@c.com", which browsers accept but we do not.
  const onEdit = (event) => {
    const el = event.target;
    if (!el || !el.hasAttribute) return;
    if (el.hasAttribute(AUTO_FLAG)) {
      el.setCustomValidity('');
      el.removeAttribute(AUTO_FLAG);
    }
    if (el.tagName === 'INPUT' && el.type === 'email' && el.value && !EMAIL_REGEX.test(el.value.trim())) {
      if (!el.validity.customError) {
        el.setCustomValidity(EMAIL_INVALID);
        el.setAttribute(AUTO_FLAG, 'true');
      }
    }
  };
  document.addEventListener('input', onEdit, true);
  document.addEventListener('change', onEdit, true);

  // Red * on labels — now, and for every field React renders later.
  if (typeof MutationObserver !== 'undefined') {
    let scheduled = false;
    const pending = new Set();
    const flush = () => {
      scheduled = false;
      pending.forEach(syncTree);
      pending.clear();
    };
    const queue = (node) => {
      pending.add(node);
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    };
    syncTree(document.body);
    new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.type === 'attributes') queue(m.target); // `required` toggled
        else m.addedNodes.forEach(queue);
      });
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['required'],
    });
  }
}

/**
 * Safety net: any text-like <input> or <textarea> that has no explicit maxLength gets a default
 * one, so a newly added field can never accept unlimited text. Fields that already declare
 * maxLength (see utils/inputLimits.js) are left untouched.
 */
const DEFAULT_TEXT_LIMIT = 100;
const DEFAULT_TEXTAREA_LIMIT = 500;
const LIMITED_INPUT_TYPES = ['text', 'search', 'email', 'tel', 'url', 'password'];

const applyDefaultLimit = (el) => {
  if (!el || el.hasAttribute('maxlength')) return;
  if (el.tagName === 'TEXTAREA') {
    el.setAttribute('maxlength', String(DEFAULT_TEXTAREA_LIMIT));
  } else if (el.tagName === 'INPUT' && LIMITED_INPUT_TYPES.includes((el.getAttribute('type') || 'text').toLowerCase())) {
    el.setAttribute('maxlength', String(DEFAULT_TEXT_LIMIT));
  }
};

const applyDefaultLimits = (root) => {
  if (!root || root.nodeType !== 1) return;
  applyDefaultLimit(root);
  root.querySelectorAll('input, textarea').forEach(applyDefaultLimit);
};

export function installDefaultInputLimits() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  applyDefaultLimits(document.body);
  new MutationObserver((mutations) => {
    mutations.forEach((m) => m.addedNodes.forEach(applyDefaultLimits));
  }).observe(document.body, { childList: true, subtree: true });
}