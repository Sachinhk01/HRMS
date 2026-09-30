import '../styles/required-fields.css';

/** Red "*" — use next to a label when a field is mandatory. */
export function RequiredMark() {
  return <span className="required-star" aria-hidden="true">*</span>;
}

/** Red inline error text shown under a field. Renders nothing when there is no message. */
export function FieldError({ message, id }) {
  if (!message) return null;
  return (
    <p className="field-error" id={id} role="alert">
      {message}
    </p>
  );
}

/**
 * Optional wrapper for new forms:
 *   <FormField label="Email" required error={errors.email}>
 *     <input type="email" ... />
 *   </FormField>
 */
export default function FormField({ label, required = false, error, className = 'form-field', children }) {
  return (
    <label className={className}>
      <span>
        {label}
        {required && <RequiredMark />}
      </span>
      {children}
      <FieldError message={error} />
    </label>
  );
}