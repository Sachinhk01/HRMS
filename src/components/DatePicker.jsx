import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './DatePicker.css';

/**
 * DatePicker / MonthPicker
 * ------------------------
 * Drop-in replacement for <input type="date"> and <input type="month">.
 *
 * Why: the browser's native date popup is not part of the page DOM, so automation tools
 * (Selenium / Playwright / Cypress) cannot click a day, and "Inspect" shows nothing useful.
 * This calendar is plain DOM: every day is a real <button data-date="2026-09-29">, and the
 * month / year are real <select> elements, so they can be clicked, inspected and tested.
 *
 * Same API as the native input, so existing code keeps working:
 *   <DatePicker value={iso} onChange={(e) => setX(e.target.value)} min max required disabled name id />
 *   - value / onChange use ISO strings: "yyyy-MM-dd" (DatePicker) and "yyyy-MM" (MonthPicker)
 *   - works controlled (value) and uncontrolled (defaultValue + name, read through FormData -> ISO)
 *   - the box shows dd-mm-yyyy (mm-yyyy for months); you can click it to pick or type into it
 *
 * Automation hooks:
 *   input   : data-testid="date-input-<id or name>", data-value="<ISO>", aria-expanded
 *   popup   : data-testid="dp-popup"
 *   nav     : dp-prev-month, dp-next-month, dp-month-select, dp-year-select, dp-today, dp-clear
 *   day     : data-testid="dp-day-2026-09-29", data-date="2026-09-29", aria-label="29 September 2026"
 *   month   : data-testid="dp-month-2026-09", data-month="2026-09" (MonthPicker)
 *   typing  : fill("29-09-2026") or fill("2026-09-29") both work
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n, width = 2) => String(n).padStart(width, '0');
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const dateIso = (y, m, d) => `${pad(y, 4)}-${pad(m + 1)}-${pad(d)}`;
const monthIso = (y, m) => `${pad(y, 4)}-${pad(m + 1)}`;

function parseDate(str) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof str === 'string' ? str : '');
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  if (y < 1000 || m < 0 || m > 11 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

function parseMonth(str) {
  const match = /^(\d{4})-(\d{2})/.exec(typeof str === 'string' ? str : '');
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  if (y < 1000 || m < 0 || m > 11) return null;
  return { y, m };
}

const todayParts = () => {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
};

const MODES = {
  date: {
    digits: 8,
    maxLength: 10,
    placeholder: 'dd-mm-yyyy',
    label: 'date',
    isoPattern: /^(\d{4})-(\d{2})-(\d{2})$/,
    isoToDigits: (m) => `${m[3]}${m[2]}${m[1]}`,
    normalize: (v) => {
      const p = parseDate(v);
      return p ? dateIso(p.y, p.m, p.d) : '';
    },
    format: (iso) => {
      const p = parseDate(iso);
      return p ? `${pad(p.d)}-${pad(p.m + 1)}-${pad(p.y, 4)}` : '';
    },
    mask: (d) => [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('-'),
    fromDigits: (d) => {
      if (d.length !== 8) return null;
      const iso = `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
      return parseDate(iso) ? iso : null;
    },
  },
  month: {
    digits: 6,
    maxLength: 7,
    placeholder: 'mm-yyyy',
    label: 'month',
    isoPattern: /^(\d{4})-(\d{2})$/,
    isoToDigits: (m) => `${m[2]}${m[1]}`,
    normalize: (v) => {
      const p = parseMonth(v);
      return p ? monthIso(p.y, p.m) : '';
    },
    format: (iso) => {
      const p = parseMonth(iso);
      return p ? `${pad(p.m + 1)}-${pad(p.y, 4)}` : '';
    },
    mask: (d) => [d.slice(0, 2), d.slice(2, 6)].filter(Boolean).join('-'),
    fromDigits: (d) => {
      if (d.length !== 6) return null;
      const iso = `${d.slice(2, 6)}-${d.slice(0, 2)}`;
      return parseMonth(iso) ? iso : null;
    },
  },
};

const clamp = (iso, min, max) => {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
};

/* ------------------------------------------------------------------------------------------ */
/* Popup frame: portal + positioning + outside click + Escape                                   */
/* ------------------------------------------------------------------------------------------ */

function PopupFrame({ anchorRef, popupRef, onRequestClose, label, layoutKey, children }) {
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const popup = popupRef.current;
    if (!anchor || !popup) return;
    const rect = anchor.getBoundingClientRect();
    const width = popup.offsetWidth;
    const height = popup.offsetHeight;
    const gap = 6;
    const margin = 8;
    let top = rect.bottom + gap;
    if (top + height > window.innerHeight - margin) {
      const above = rect.top - gap - height;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - margin - height);
    }
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    setPos({ top, left });
  }, [anchorRef, popupRef]);

  useLayoutEffect(() => {
    place();
  }, [place, layoutKey]);

  useEffect(() => {
    const onDown = (event) => {
      const target = event.target;
      if (popupRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onRequestClose(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation(); // don't let Esc also close a modal behind the calendar
        onRequestClose(true);
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
  }, [anchorRef, popupRef, onRequestClose, place]);

  return createPortal(
    <div
      ref={popupRef}
      className="dp-popup"
      role="dialog"
      aria-label={label}
      data-testid="dp-popup"
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }} // positioned in a layout effect, before the first paint
      // keep clicks inside the calendar from reaching a modal/backdrop handler higher up the React tree
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Day calendar                                                                                 */
/* ------------------------------------------------------------------------------------------ */

function DayPopup({ iso, min, max, onSelect, onClear, keyboardOpen, anchorRef, popupRef, onRequestClose }) {
  const today = todayParts();
  const todayIso = dateIso(today.y, today.m, today.d);
  const minP = parseDate(min);
  const maxP = parseDate(max);
  const selected = parseDate(iso);

  const [view, setView] = useState(() => {
    if (selected) return { y: selected.y, m: selected.m };
    const start = parseDate(clamp(todayIso, min, max)) || today;
    return { y: start.y, m: start.m };
  });

  const viewKey = monthIso(view.y, view.m);
  const monthStart = `${viewKey}-01`;
  const monthEnd = `${viewKey}-${pad(daysInMonth(view.y, view.m))}`;
  const inView = (candidate) => candidate && candidate.startsWith(viewKey);

  // the day that is reachable with Tab (roving tabindex)
  const tabIso = useMemo(() => {
    if (inView(iso)) return iso;
    if (inView(todayIso)) return todayIso;
    return clamp(monthStart, min, max) <= monthEnd ? clamp(monthStart, min, max) : monthStart;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, todayIso, viewKey, min, max]);

  const [focusIso, setFocusIso] = useState(keyboardOpen ? tabIso : null);
  useEffect(() => {
    if (!focusIso) return;
    popupRef.current?.querySelector(`[data-date="${focusIso}"]`)?.focus({ preventScroll: true });
  }, [focusIso, viewKey, popupRef]);

  const minYear = Math.min(Math.max(minP ? minP.y : today.y - 120, today.y - 120), view.y);
  const maxYear = Math.max(Math.min(maxP ? maxP.y : today.y + 50, today.y + 50), view.y);
  const years = [];
  for (let y = minYear; y <= maxYear; y += 1) years.push(y);

  const monthOutOfRange = (y, m) => {
    const key = monthIso(y, m);
    return (min && key < min.slice(0, 7)) || (max && key > max.slice(0, 7));
  };

  const goTo = (y, m) => {
    // clamp the month if the chosen year would land outside min / max
    let ny = y;
    let nm = m;
    if (minP && monthIso(ny, nm) < monthIso(minP.y, minP.m)) { ny = minP.y; nm = minP.m; }
    if (maxP && monthIso(ny, nm) > monthIso(maxP.y, maxP.m)) { ny = maxP.y; nm = maxP.m; }
    setView({ y: ny, m: nm });
  };
  const shiftMonth = (delta) => {
    const total = view.y * 12 + view.m + delta;
    goTo(Math.floor(total / 12), ((total % 12) + 12) % 12);
  };

  const prevDisabled = monthOutOfRange(...(view.m === 0 ? [view.y - 1, 11] : [view.y, view.m - 1]));
  const nextDisabled = monthOutOfRange(...(view.m === 11 ? [view.y + 1, 0] : [view.y, view.m + 1]));

  const cells = [];
  const blanks = new Date(view.y, view.m, 1).getDay();
  for (let i = 0; i < blanks; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth(view.y, view.m); d += 1) cells.push(d);
  while (cells.length < 42) cells.push(null); // always 6 rows so the popup never changes height
  const weeks = [];
  for (let i = 0; i < 42; i += 7) weeks.push(cells.slice(i, i + 7));

  const onGridKeyDown = (event) => {
    const target = event.target.closest?.('[data-date]');
    const cur = target && parseDate(target.getAttribute('data-date'));
    if (!cur) return;
    let dayDelta = 0;
    let monthDelta = 0;
    const weekday = new Date(cur.y, cur.m, cur.d).getDay();
    switch (event.key) {
      case 'ArrowLeft': dayDelta = -1; break;
      case 'ArrowRight': dayDelta = 1; break;
      case 'ArrowUp': dayDelta = -7; break;
      case 'ArrowDown': dayDelta = 7; break;
      case 'Home': dayDelta = -weekday; break;
      case 'End': dayDelta = 6 - weekday; break;
      case 'PageUp': monthDelta = event.shiftKey ? -12 : -1; break;
      case 'PageDown': monthDelta = event.shiftKey ? 12 : 1; break;
      default: return;
    }
    event.preventDefault();
    const total = cur.y * 12 + cur.m + monthDelta;
    const ty = Math.floor(total / 12);
    const tm = ((total % 12) + 12) % 12;
    const base = new Date(ty, tm, Math.min(cur.d, daysInMonth(ty, tm)) + dayDelta);
    const next = dateIso(base.getFullYear(), base.getMonth(), base.getDate());
    if ((min && next < min) || (max && next > max)) return;
    setView({ y: base.getFullYear(), m: base.getMonth() });
    setFocusIso(next);
  };

  return (
    <PopupFrame anchorRef={anchorRef} popupRef={popupRef} onRequestClose={onRequestClose} label="Choose date" layoutKey="day">
      <div className="dp-head">
        <button type="button" className="dp-nav" aria-label="Previous month" data-testid="dp-prev-month" disabled={prevDisabled} onClick={() => shiftMonth(-1)}>
          <ChevronLeft size={18} />
        </button>
        <div className="dp-selects">
          <select className="dp-select" aria-label="Month" data-testid="dp-month-select" value={view.m} onChange={(e) => goTo(view.y, Number(e.target.value))}>
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index} disabled={monthOutOfRange(view.y, index)}>{name}</option>
            ))}
          </select>
          <select className="dp-select" aria-label="Year" data-testid="dp-year-select" value={view.y} onChange={(e) => goTo(Number(e.target.value), view.m)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" className="dp-nav" aria-label="Next month" data-testid="dp-next-month" disabled={nextDisabled} onClick={() => shiftMonth(1)}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="dp-weekdays" role="row">
        {WEEKDAYS.map((w) => <span key={w} role="columnheader">{w}</span>)}
      </div>

      <div className="dp-grid" role="grid" aria-label={`${MONTH_NAMES[view.m]} ${view.y}`} data-testid="dp-grid" onKeyDown={onGridKeyDown}>
        {weeks.map((week, wi) => (
          <div className="dp-week" role="row" key={wi}>
            {week.map((day, di) => {
              if (!day) return <span className="dp-blank" role="presentation" key={di} />;
              const dIso = dateIso(view.y, view.m, day);
              const disabled = Boolean((min && dIso < min) || (max && dIso > max));
              const classes = ['dp-day'];
              if (dIso === iso) classes.push('is-selected');
              if (dIso === todayIso) classes.push('is-today');
              return (
                <button
                  key={di}
                  type="button"
                  role="gridcell"
                  className={classes.join(' ')}
                  disabled={disabled}
                  data-date={dIso}
                  data-testid={`dp-day-${dIso}`}
                  aria-label={`${day} ${MONTH_NAMES[view.m]} ${view.y}`}
                  aria-selected={dIso === iso}
                  aria-current={dIso === todayIso ? 'date' : undefined}
                  tabIndex={dIso === tabIso ? 0 : -1}
                  onClick={() => onSelect(dIso)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="dp-foot">
        <button type="button" className="dp-link" data-testid="dp-today" disabled={Boolean((min && todayIso < min) || (max && todayIso > max))} onClick={() => onSelect(todayIso)}>
          Today
        </button>
        <button type="button" className="dp-link dp-link--muted" data-testid="dp-clear" disabled={!iso} onClick={onClear}>
          Clear
        </button>
      </div>
    </PopupFrame>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Month calendar                                                                               */
/* ------------------------------------------------------------------------------------------ */

function MonthPopup({ iso, min, max, onSelect, onClear, keyboardOpen, anchorRef, popupRef, onRequestClose }) {
  const today = todayParts();
  const thisMonth = monthIso(today.y, today.m);
  const minP = parseMonth(min);
  const maxP = parseMonth(max);
  const selected = parseMonth(iso);

  const [year, setYear] = useState(() => {
    if (selected) return selected.y;
    const start = parseMonth(clamp(thisMonth, min && min.slice(0, 7), max && max.slice(0, 7)));
    return (start || today).y;
  });

  const minKey = min ? min.slice(0, 7) : '';
  const maxKey = max ? max.slice(0, 7) : '';
  const outOfRange = (key) => Boolean((minKey && key < minKey) || (maxKey && key > maxKey));

  const minYear = Math.min(Math.max(minP ? minP.y : today.y - 120, today.y - 120), year);
  const maxYear = Math.max(Math.min(maxP ? maxP.y : today.y + 50, today.y + 50), year);
  const years = [];
  for (let y = minYear; y <= maxYear; y += 1) years.push(y);

  const [focusKey, setFocusKey] = useState(keyboardOpen ? (selected ? iso : `${pad(year, 4)}-01`) : null);
  useEffect(() => {
    if (!focusKey) return;
    popupRef.current?.querySelector(`[data-month="${focusKey}"]`)?.focus({ preventScroll: true });
  }, [focusKey, year, popupRef]);

  const onGridKeyDown = (event) => {
    const target = event.target.closest?.('[data-month]');
    const cur = target && parseMonth(target.getAttribute('data-month'));
    if (!cur) return;
    const deltas = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4, PageUp: -12, PageDown: 12 };
    if (!(event.key in deltas)) return;
    event.preventDefault();
    const total = cur.y * 12 + cur.m + deltas[event.key];
    const ny = Math.floor(total / 12);
    const nm = ((total % 12) + 12) % 12;
    const key = monthIso(ny, nm);
    if (outOfRange(key)) return;
    setYear(ny);
    setFocusKey(key);
  };

  return (
    <PopupFrame anchorRef={anchorRef} popupRef={popupRef} onRequestClose={onRequestClose} label="Choose month" layoutKey="month">
      <div className="dp-head">
        <button type="button" className="dp-nav" aria-label="Previous year" data-testid="dp-prev-year" disabled={Boolean(minP && year <= minP.y)} onClick={() => setYear(year - 1)}>
          <ChevronLeft size={18} />
        </button>
        <div className="dp-selects">
          <select className="dp-select" aria-label="Year" data-testid="dp-year-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" className="dp-nav" aria-label="Next year" data-testid="dp-next-year" disabled={Boolean(maxP && year >= maxP.y)} onClick={() => setYear(year + 1)}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="dp-months" role="grid" aria-label={`Months of ${year}`} data-testid="dp-grid" onKeyDown={onGridKeyDown}>
        {[0, 1, 2].map((row) => (
          <div className="dp-mrow" role="row" key={row}>
            {[0, 1, 2, 3].map((col) => {
              const m = row * 4 + col;
              const key = monthIso(year, m);
              const classes = ['dp-month'];
              if (key === iso) classes.push('is-selected');
              if (key === thisMonth) classes.push('is-today');
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  className={classes.join(' ')}
                  disabled={outOfRange(key)}
                  data-month={key}
                  data-testid={`dp-month-${key}`}
                  aria-label={`${MONTH_NAMES[m]} ${year}`}
                  aria-selected={key === iso}
                  aria-current={key === thisMonth ? 'date' : undefined}
                  tabIndex={key === iso || (!selected && key === `${pad(year, 4)}-01`) ? 0 : -1}
                  onClick={() => onSelect(key)}
                >
                  {MONTH_SHORT[m]}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="dp-foot">
        <button type="button" className="dp-link" data-testid="dp-today" disabled={outOfRange(thisMonth)} onClick={() => onSelect(thisMonth)}>
          This month
        </button>
        <button type="button" className="dp-link dp-link--muted" data-testid="dp-clear" disabled={!iso} onClick={onClear}>
          Clear
        </button>
      </div>
    </PopupFrame>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* The input                                                                                    */
/* ------------------------------------------------------------------------------------------ */

function PickerInput({
  mode,
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  onClick,
  onKeyDown,
  name,
  id,
  min,
  max,
  required,
  disabled,
  readOnly,
  placeholder,
  className = '',
  ...rest
}) {
  const cfg = MODES[mode];
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => cfg.normalize(defaultValue));
  const iso = controlled ? cfg.normalize(value) : inner;
  const minV = cfg.normalize(min);
  const maxV = cfg.normalize(max);

  const [text, setText] = useState(() => cfg.format(iso));
  const [open, setOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const inputRef = useRef(null);
  const popupRef = useRef(null);
  const editingRef = useRef(false);

  // keep the visible text in sync when the value changes from outside (reset, other field, API load)
  useEffect(() => {
    if (editingRef.current) {
      editingRef.current = false;
      return;
    }
    setText(cfg.format(iso));
  }, [iso, cfg]);

  // native-like validation messages (required is handled by the browser through the empty text)
  const validityMessage = (() => {
    const digits = text.replace(/\D/g, '');
    if (!digits) return '';
    const parsed = cfg.fromDigits(digits);
    if (!parsed) return `Please enter a valid ${cfg.label} (${cfg.placeholder}).`;
    if (minV && parsed < minV) return `Please select a ${cfg.label} on or after ${cfg.format(minV)}.`;
    if (maxV && parsed > maxV) return `Please select a ${cfg.label} on or before ${cfg.format(maxV)}.`;
    return '';
  })();
  useEffect(() => {
    inputRef.current?.setCustomValidity(validityMessage);
  }, [validityMessage]);

  // <form> submit / new FormData(form) must receive the ISO value, not the dd-mm-yyyy text
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || !name || disabled) return undefined;
    const handler = (event) => event.formData.set(name, iso);
    form.addEventListener('formdata', handler);
    return () => form.removeEventListener('formdata', handler);
  }, [name, iso, disabled]);

  const emit = (next) => {
    if (!controlled) setInner(next);
    if (onChange) {
      const target = { name, id, value: next, type: mode };
      onChange({ target, currentTarget: target, type: 'change', preventDefault() {}, stopPropagation() {}, persist() {} });
    }
  };

  const commit = (next) => {
    editingRef.current = false;
    setText(cfg.format(next));
    if (next !== iso) emit(next);
  };

  const closePopup = useCallback((refocus) => {
    setOpen(false);
    setKeyboardOpen(false);
    if (refocus) inputRef.current?.focus();
  }, []);

  const handleText = (event) => {
    const raw = event.target.value;
    const isoMatch = cfg.isoPattern.exec(raw); // lets fill("2026-09-29") work as well as fill("29-09-2026")
    let digits = isoMatch ? cfg.isoToDigits(isoMatch) : raw.replace(/\D/g, '').slice(0, cfg.digits);
    const previousDigits = text.replace(/\D/g, '');
    if (!isoMatch && raw.length < text.length && digits === previousDigits) digits = digits.slice(0, -1); // backspace over a "-"
    setText(cfg.mask(digits));

    let next = '';
    if (digits.length === cfg.digits) {
      const parsed = cfg.fromDigits(digits);
      if (parsed && (!minV || parsed >= minV) && (!maxV || parsed <= maxV)) next = parsed;
    }
    if (next !== iso) {
      editingRef.current = true;
      emit(next);
    }
  };

  const handleKeyDown = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || readOnly) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setKeyboardOpen(true);
      setOpen(true);
    } else if (event.key === 'Tab' && open) {
      setOpen(false);
    }
  };

  const handleClick = (event) => {
    onClick?.(event);
    if (disabled || readOnly) return;
    setKeyboardOpen(false);
    setOpen(true);
  };

  const handleBlur = (event) => {
    editingRef.current = false;
    setText(cfg.format(iso)); // drop half-typed text so what you see is what is saved
    onBlur?.(event);
  };

  const testId = rest['data-testid'] ?? (id || name ? `${mode}-input-${id || name}` : undefined);

  return (
    <>
      <input
        {...rest}
        ref={inputRef}
        type="text"
        id={id}
        name={name}
        className={`dp-input dp-input--${mode} ${className}`.trim()}
        value={text}
        placeholder={placeholder ?? cfg.placeholder}
        maxLength={cfg.maxLength}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete="off"
        inputMode="numeric"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-picker={mode}
        data-value={iso}
        data-testid={testId}
        onChange={handleText}
        onClick={handleClick}
        onFocus={onFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {open && (
        mode === 'month' ? (
          <MonthPopup
            iso={iso}
            min={minV}
            max={maxV}
            keyboardOpen={keyboardOpen}
            anchorRef={inputRef}
            popupRef={popupRef}
            onRequestClose={closePopup}
            onSelect={(next) => { commit(next); closePopup(true); }}
            onClear={() => { commit(''); closePopup(true); }}
          />
        ) : (
          <DayPopup
            iso={iso}
            min={minV}
            max={maxV}
            keyboardOpen={keyboardOpen}
            anchorRef={inputRef}
            popupRef={popupRef}
            onRequestClose={closePopup}
            onSelect={(next) => { commit(next); closePopup(true); }}
            onClear={() => { commit(''); closePopup(true); }}
          />
        )
      )}
    </>
  );
}

export default function DatePicker(props) {
  return <PickerInput mode="date" {...props} />;
}

export function MonthPicker(props) {
  return <PickerInput mode="month" {...props} />;
}