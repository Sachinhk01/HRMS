import { useEffect, useRef, useState } from 'react';
import { Cake, ChevronLeft, ChevronRight, PartyPopper, CalendarDays } from 'lucide-react';
import { capitalizeName } from '../utils/formatName';

function getInitials(name = '') {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function getDaysUntilBirthday(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const diff = Math.round((next - today) / 86400000);
  return diff;
}

function isBirthdayToday(dateOfBirth) {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
}

function formatUpcomingDate(dateOfBirth) {
  if (!dateOfBirth) return '';
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return next.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

const SLIDE_TODAY = 0;
const SLIDE_UPCOMING = 1;

export default function BirthdayWidget({ employees = [], onViewAll }) {
  const [slide, setSlide] = useState(SLIDE_TODAY);
  const [animDir, setAnimDir] = useState(null); // 'left' | 'right'
  const [isAnimating, setIsAnimating] = useState(false);
  const timerRef = useRef(null);

  const getDob = (e) => e?.dateOfBirth || e?.dob || e?.createdAt;

  const todaysBirthdays = employees.filter((e) => isBirthdayToday(getDob(e)));
  const upcomingBirthdays = employees
    .filter((e) => {
      const days = getDaysUntilBirthday(getDob(e));
      return days !== null && days > 0 && days <= 30;
    })
    .sort((a, b) => {
      const da = getDaysUntilBirthday(getDob(a));
      const db = getDaysUntilBirthday(getDob(b));
      return da - db;
    })
    .slice(0, 10);

  // Auto-advance every 6 s
  useEffect(() => {
    timerRef.current = setInterval(() => goTo(1), 6000);
    return () => clearInterval(timerRef.current);
  }, [slide]);

  function goTo(direction) {
    if (isAnimating) return;
    setAnimDir(direction > 0 ? 'left' : 'right');
    setIsAnimating(true);
    setTimeout(() => {
      setSlide((s) => (s + direction + 2) % 2);
      setAnimDir(null);
      setIsAnimating(false);
    }, 340);
  }

  function jumpTo(idx) {
    if (idx === slide || isAnimating) return;
    goTo(idx > slide ? 1 : -1);
  }

  const slides = [
    {
      id: SLIDE_TODAY,
      label: "Today's Birthdays",
      icon: Cake,
      accent: '#f59e0b',
      accentBg: 'linear-gradient(135deg,#fffbeb,#fff7ed)',
      accentBorder: '#fde68a',
      items: todaysBirthdays,
      empty: 'No birthdays today — check back tomorrow!',
      emptyIcon: '🎂',
      badge: todaysBirthdays.length,
      chipColor: '#f59e0b',
      chipBg: '#fff7ed',
    },
    {
      id: SLIDE_UPCOMING,
      label: 'Upcoming Birthdays',
      icon: CalendarDays,
      accent: '#3b82f6',
      accentBg: 'linear-gradient(135deg,#eff6ff,#eef2ff)',
      accentBorder: '#bfdbfe',
      items: upcomingBirthdays,
      empty: 'No birthdays in the next 30 days.',
      emptyIcon: '📅',
      badge: upcomingBirthdays.length,
      chipColor: '#3b82f6',
      chipBg: '#eff6ff',
    },
  ];

  const current = slides[slide];

  return (
    <section className="celebration-widget panel">
      {/* Header */}
      <div className="cw-header">
        <div className="cw-header-left">
          <div className="cw-header-icon" style={{ background: current.accentBg, border: `1px solid ${current.accentBorder}` }}>
            <current.icon size={22} color={current.accent} />
          </div>
          <div>
            <span className="cw-eyebrow">Celebration Wall</span>
            <h2 className="cw-title">{current.label}</h2>
          </div>
        </div>
        <div className="cw-header-right">
          <div className="cw-dots">
            {slides.map((s, i) => (
              <button key={i} className={`cw-dot${slide === i ? ' active' : ''}`} onClick={() => jumpTo(i)} aria-label={s.label} />
            ))}
          </div>
          <div className="cw-nav">
            <button className="cw-nav-btn" onClick={() => goTo(-1)} aria-label="Previous"><ChevronLeft size={17} /></button>
            <button className="cw-nav-btn" onClick={() => goTo(1)} aria-label="Next"><ChevronRight size={17} /></button>
          </div>
          {onViewAll && (
            <button className="cw-view-all" onClick={onViewAll}>
              View All <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Slide tabs */}
      <div className="cw-tabs">
        {slides.map((s, i) => (
          <button
            key={i}
            className={`cw-tab${slide === i ? ' active' : ''}`}
            onClick={() => jumpTo(i)}
            style={slide === i ? { color: s.accent, borderColor: s.accent } : {}}
          >
            <s.icon size={15} />
            {s.label}
            {s.badge > 0 && (
              <span className="cw-tab-badge" style={{ background: s.chipBg, color: s.chipColor }}>{s.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Slider track */}
      <div className={`cw-track${animDir ? ` cw-exit-${animDir}` : ''}`}>
        {current.items.length === 0 ? (
          <div className="cw-empty">
            <span className="cw-empty-icon">{current.emptyIcon}</span>
            <span>{current.empty}</span>
          </div>
        ) : (
          <div className="cw-cards">
            {current.items.map((emp) => {
              const dob = getDob(emp);
              const days = getDaysUntilBirthday(dob);
              const isToday = days === 0 || isBirthdayToday(dob);
              return (
                <div className="cw-person-card" key={emp.id}
                  style={{ '--card-accent': current.accent, '--card-bg': current.accentBg, '--card-border': current.accentBorder }}>
                  <div className="cw-person-avatar" style={{ background: isToday ? 'linear-gradient(135deg,#f59e0b,#f97316)' : 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                    {getInitials(emp.name)}
                  </div>
                  <div className="cw-person-copy">
                    <strong>{capitalizeName(emp.name)}</strong>
                    <span className="cw-person-role">{emp.designation || emp.department || 'Team member'}</span>
                    {isToday ? (
                      <span className="cw-person-tag" style={{ background: '#fff7ed', color: '#f59e0b' }}>🎂 Today!</span>
                    ) : (
                      <span className="cw-person-tag" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                        {formatUpcomingDate(dob)} · {days}d
                      </span>
                    )}
                  </div>
                  {isToday && <span className="cw-confetti">🎉</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="cw-progress">
        <div className="cw-progress-fill" style={{ background: current.accent }} key={`${slide}-progress`} />
      </div>
    </section>
  );
}