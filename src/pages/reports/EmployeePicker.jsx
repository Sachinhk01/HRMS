import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Users, X } from 'lucide-react';
import './EmployeePicker.css';

const MAX_RESULTS = 50;

const initials = (name) =>
  (name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || '?';
const tone = (id) => Math.abs(Number(id) || 0) % 5;
const labelOf = (employee) => (employee.employeeName || '').trim();

export default function EmployeePicker({ employees = [], value = '', onChange, maxLength = 100 }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const selected = useMemo(
    () => employees.find((employee) => String(employee.id) === String(value)) || null,
    [employees, value],
  );

  const term = query.trim().toLowerCase();
  const { matches, total } = useMemo(() => {
    const all = employees.filter((employee) => !term
      || labelOf(employee).toLowerCase().includes(term)
      || String(employee.employeeCode || '').toLowerCase().includes(term));
    return { matches: all.slice(0, MAX_RESULTS), total: all.length };
  }, [employees, term]);

  const options = useMemo(
    () => (term ? matches : [{ id: '', all: true }, ...matches]),
    [matches, term],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function openList() {
    if (open) return;
    setOpen(true);
    setQuery('');
    const selectedIndex = selected
      ? employees.findIndex((employee) => String(employee.id) === String(selected.id)) + 1
      : 0;
    setActive(Math.max(selectedIndex, 0));
  }

  function choose(option) {
    onChange?.(option.all ? '' : String(option.id));
    setOpen(false);
    setQuery('');
  }

  function clear(event) {
    event.stopPropagation();
    onChange?.('');
    setQuery('');
    inputRef.current?.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openList();
      } else if (options.length) {
        setActive((index) => Math.min(index + 1, options.length - 1));
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (options.length) setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      if (open && options[active]) {
        event.preventDefault();
        choose(options[active]);
      }
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false);
      setQuery('');
    }
  }

  const showingSelected = Boolean(selected) && !open;

  return (
    <div className={`ep${open ? ' is-open' : ''}`} ref={wrapRef}>
      <div className="ep-control" onClick={() => { inputRef.current?.focus(); openList(); }}>
        {showingSelected ? (
          <span className={`ep-avatar ep-avatar-${tone(selected.id)}`}>{initials(labelOf(selected))}</span>
        ) : (
          <Search size={15} className="ep-icon" />
        )}

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Employee"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && options[active] ? `${listId}-option-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          maxLength={maxLength}
          placeholder={showingSelected ? '' : 'Search by name or code…'}
          value={showingSelected
            ? `${labelOf(selected)}${selected.employeeCode ? ` (${selected.employeeCode})` : ''}`
            : query}
          onFocus={openList}
          onChange={(event) => { setQuery(event.target.value); setActive(0); if (!open) setOpen(true); }}
          onKeyDown={onKeyDown}
        />

        {selected ? (
          <button
            type="button"
            className="ep-clear"
            aria-label="Clear employee"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
          >
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={16} className="ep-caret" />
        )}
      </div>

      {open && (
        <ul className="ep-list" id={listId} role="listbox" ref={listRef}>
          {options.map((option, index) => {
            const isAll = Boolean(option.all);
            const isSelected = isAll
              ? !selected
              : selected && String(selected.id) === String(option.id);
            return (
              <li
                id={`${listId}-option-${index}`}
                key={isAll ? 'all' : option.id}
                role="option"
                aria-selected={Boolean(isSelected)}
                data-active={index === active}
                className={`ep-option${index === active ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}`}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {isAll ? (
                  <>
                    <span className="ep-avatar ep-avatar-all"><Users size={14} /></span>
                    <span className="ep-text"><strong>All employees</strong><small>No employee filter</small></span>
                  </>
                ) : (
                  <>
                    <span className={`ep-avatar ep-avatar-${tone(option.id)}`}>{initials(labelOf(option))}</span>
                    <span className="ep-text">
                      <strong>{labelOf(option) || 'Unnamed employee'}</strong>
                      <small>{option.employeeCode}</small>
                    </span>
                  </>
                )}
                {isSelected && <Check size={15} className="ep-check" />}
              </li>
            );
          })}

          {term && matches.length === 0 && (
            <li className="ep-empty">No employee matches “{query.trim()}”</li>
          )}
          {total > MAX_RESULTS && (
            <li className="ep-more">Showing {MAX_RESULTS} of {total} — type more to narrow down</li>
          )}
        </ul>
      )}
    </div>
  );
}
