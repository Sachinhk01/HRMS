import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './SelectBox.css';

/**
 * SelectBox
 * ---------
 * Drop-in replacement for a native <select> that can be clicked, typed into and inspected
 * by automation tools (Selenium / Playwright / Cypress).
 *
 * Why: the browser's native <select> list is drawn by the operating system, not by the page,
 * so automation cannot click an <option> and "Inspect" shows nothing useful. This control is
 * plain DOM: a text field (combobox) plus a list whose rows are real elements.
 *
 * Same API style as DatePicker:
 *   <SelectBox
 *     id="salary-template" name="salaryTemplateId"
 *     value={form.salaryTemplateId}                       // option value (string or number)
 *     onChange={(event) => setForm({ ...form, salaryTemplateId: event.target.value })}
 *     options={[{ value: 1, label: 'FULL TIME' }, ...]}
 *     placeholder="Select template…" required
 *     loading={templatesLoading} emptyText="No salary templates found"
 *   />
 *   - onChange receives { target: { name, id, value } } where value is always a string
 *   - the box shows the selected label; click it to pick, or type to filter the list
 *
 * Automation hooks (testId defaults to the id or name):
 *   input    : data-testid="select-input-<id>", role="combobox", data-value="<value>",
 *              data-selected-label="<label>", aria-expanded, data-loading
 *   popup    : data-testid="select-popup-<id>", role="listbox"
 *   option   : role="option", data-testid="select-option-<id>-<value>", data-value="<value>",
 *              aria-selected
 *   empty    : data-testid="select-empty-<id>"
 *   typing   : fill("MANAGER ANAGHA") then press Enter (or Tab) to choose the match.
 *              Typing the exact label and leaving the field also selects it.
 *   keyboard : ArrowDown / ArrowUp / Home / End to move, Enter to choose, Escape to close
 */

const norm = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export default function SelectBox({
  id,
  name,
  value = '',
  onChange,
  onBlur,
  onFocus,
  options = [],
  placeholder = 'Select…',
  required = false,
  disabled = false,
  loading = false,
  emptyText = 'No options found',
  className = '',
  'data-testid': testIdProp,
  ...rest
}) {
  const inputRef = useRef(null);
  const popupRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false); // true while the user is filtering
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);

  const key = testIdProp ?? (id || name || 'field');
  const strValue = value === null || value === undefined ? '' : String(value);

  const normalized = useMemo(
    () => options.map((item) => ({ ...item, value: String(item.value), label: String(item.label ?? item.value) })),
    [options]
  );
  const selected = normalized.find((item) => item.value === strValue) || null;
  const selectedLabel = selected ? selected.label : '';
  // "Loading…" replaces the list only while there is nothing to show yet. When names are
  // already available (a refresh) they stay visible and clickable.
  const showLoading = loading && normalized.length === 0;

  const visible = useMemo(() => {
    if (!typing || !query.trim()) return normalized;
    const q = norm(query);
    return normalized.filter((item) => norm(`${item.label} ${item.searchText || ''}`).includes(q));
  }, [normalized, query, typing]);

  const shownText = typing ? query : selectedLabel;

  /* ---------- committing ---------- */
  const emit = useCallback((next) => {
    onChange?.({ target: { id, name, value: next } });
  }, [onChange, id, name]);

  const closeList = useCallback(() => {
    setOpen(false);
    setTyping(false);
    setQuery('');
    setActive(-1);
  }, []);

  const choose = useCallback((item) => {
    if (item && item.value !== strValue) emit(item.value);
    closeList();
  }, [emit, strValue, closeList]);

  /* ---------- opening ---------- */
  const openList = useCallback(() => {
    if (disabled || open) return;
    setOpen(true);
    setTyping(false);
    setQuery('');
    const index = normalized.findIndex((item) => item.value === strValue);
    setActive(index);
  }, [disabled, open, normalized, strValue]);

  /* ---------- popup placement (fixed, so no parent panel can clip it) ---------- */
  const place = useCallback(() => {
    const anchor = inputRef.current;
    const popup = popupRef.current;
    if (!anchor || !popup) return;
    const rect = anchor.getBoundingClientRect();
    // the field was scrolled out of view: close instead of leaving the list floating
    if (rect.bottom < 0 || rect.top > window.innerHeight) { closeList(); return; }
    const height = popup.offsetHeight;
    const gap = 4;
    const margin = 8;
    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - margin) {
      const above = rect.top - gap - height;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - margin - height);
    }
    const width = Math.max(rect.width, 180);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    setPos({ top, left, width });
  }, [closeList]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, visible.length, showLoading]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      const target = event.target;
      if (popupRef.current?.contains(target) || inputRef.current?.contains(target)) return;
      // clicking elsewhere: keep an exact typed match, otherwise fall back to the current value
      const exact = typing ? normalized.filter((item) => norm(item.label) === norm(query)) : [];
      if (exact.length === 1) choose(exact[0]); else closeList();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation(); // don't let Esc also close a modal behind the list
        closeList();
      }
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('touchstart', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('touchstart', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, typing, query, normalized, choose, closeList, place]);

  // keep the highlighted row in view
  useEffect(() => {
    if (!open || active < 0) return;
    const row = listRef.current?.querySelector(`[data-index="${active}"]`);
    const list = listRef.current;
    if (!row || !list) return;
    // Scroll only the list itself. scrollIntoView() would also scroll (and, with smooth
    // scrolling on, animate) the page behind it.
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 4;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 4;
  }, [open, active]);

  /* ---------- input handlers ---------- */
  const handleText = (event) => {
    if (disabled) return;
    setTyping(true);
    setQuery(event.target.value);
    setOpen(true);
    setActive(0);
  };

  const handleClick = () => {
    if (disabled) return;
    if (open) closeList(); else openList();
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    const { key: k } = event;
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      event.preventDefault();
      if (!open) { openList(); return; }
      if (!visible.length) return;
      setActive((current) => {
        if (k === 'ArrowDown') return current < visible.length - 1 ? current + 1 : 0;
        return current > 0 ? current - 1 : visible.length - 1;
      });
    } else if (k === 'Home' && open) {
      event.preventDefault();
      setActive(0);
    } else if (k === 'End' && open) {
      event.preventDefault();
      setActive(visible.length - 1);
    } else if (k === 'Enter') {
      if (open) {
        event.preventDefault(); // choosing a row must not submit the form
        choose(visible[active] || visible[0]);
      }
    } else if (k === 'Tab') {
      if (open) {
        const exact = typing ? normalized.filter((item) => norm(item.label) === norm(query)) : [];
        if (exact.length === 1) choose(exact[0]);
        else if (typing && visible.length === 1) choose(visible[0]);
        else closeList();
      }
    }
  };

  const handleBlur = (event) => {
    // blur fires before a click on a list row, so never close here; outside clicks close the list
    onBlur?.(event);
  };

  return (
    <>
      <input
        {...rest}
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        className={`sb-input ${open ? 'sb-input--open' : ''} ${className}`.trim()}
        value={shownText}
        placeholder={showLoading ? 'Loading…' : placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${key}-listbox` : undefined}
        aria-activedescendant={open && active >= 0 && visible[active] ? `${key}-option-${visible[active].value}` : undefined}
        aria-busy={showLoading || undefined}
        data-picker="select"
        data-value={strValue}
        data-selected-label={selectedLabel}
        data-loading={loading ? 'true' : 'false'}
        data-option-count={normalized.length}
        data-testid={`select-input-${key}`}
        onChange={handleText}
        onClick={handleClick}
        onFocus={onFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {open && createPortal(
        <div
          ref={popupRef}
          className="sb-popup"
          data-testid={`select-popup-${key}`}
          style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { top: 0, left: 0, visibility: 'hidden' }}
          // keep clicks inside the list from reaching a modal/backdrop handler higher up the React tree
          onMouseDown={(event) => { event.stopPropagation(); event.preventDefault(); }}
          onClick={(event) => event.stopPropagation()}
        >
          <ul ref={listRef} id={`${key}-listbox`} className="sb-list" role="listbox" aria-label={rest['aria-label'] || name || id}>
            {showLoading && (
              <li className="sb-note" role="presentation" data-testid={`select-loading-${key}`}>Loading…</li>
            )}
            {!showLoading && visible.length === 0 && (
              <li className="sb-note" role="presentation" data-testid={`select-empty-${key}`}>{emptyText}</li>
            )}
            {!showLoading && visible.map((item, index) => (
              <li
                key={item.value}
                id={`${key}-option-${item.value}`}
                role="option"
                aria-selected={item.value === strValue}
                className={`sb-option${item.value === strValue ? ' is-selected' : ''}${index === active ? ' is-active' : ''}`}
                data-index={index}
                data-value={item.value}
                data-label={item.label}
                data-testid={`select-option-${key}-${item.value}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </>
  );
}