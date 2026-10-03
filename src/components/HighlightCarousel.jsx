import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Megaphone,
  PartyPopper,
  Star,
} from 'lucide-react';
import {
  getNotifications,
  hasPdfAttachment,
  parseCelebrationMeta,
} from '../services/notificationService';
import { capitalizeName } from '../utils/formatName';
import { openPdfDocument } from '../utils/openPdf';
import './HighlightCarousel.css';

const MAGAZINE_PHOTO =
  'https://images.unsplash.com/photo-1769794371055-54436b54577e?fm=jpg&q=80&w=800&auto=format&fit=crop';
const EOM_PHOTO =
  'https://images.unsplash.com/photo-1758691737584-a8f17fb34475?fm=jpg&q=80&w=800&auto=format&fit=crop';

const SLIDE_SECONDS = 6;
const SWIPE_THRESHOLD = 50;

function formatMonth(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString([], {
      month: 'long',
      year: 'numeric',
    });
  }
  return value;
}

function formatLongDate(value) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function daysFromToday(value) {
  if (!value) return null;
  const target = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function whenLabel(days) {
  if (days === null || Number.isNaN(days)) return '';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/**
 * Rotating highlight strip for the dashboard.
 *
 * Slides: Monthly Magazine, Employee of the Month, latest announcement,
 * next holiday, next birthday, and one role-based leave card.
 * Everything is built from data the Dashboard already loads, except the
 * latest announcement, which this component fetches itself.
 */
export default function HighlightCarousel({
  role = 'EMPLOYEE',
  magazine,
  employeeOfMonth,
  upcomingHoliday,
  birthdayEmployees = [],
  leaveSummary,
  leaveLoading = false,
  pendingApprovals = 0,
}) {
  const nav = useNavigate();
  const [announcement, setAnnouncement] = useState(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStartX = useRef(null);

  // ---------- Latest plain announcement (not a magazine, not a celebration) ----------
  useEffect(() => {
    let cancelled = false;

    async function loadAnnouncement() {
      try {
        const result = await getNotifications({ page: 0, size: 50 });
        const items = result?.content || [];
        const latest = items
          .filter(
            (item) =>
              item.notificationType === 'ANNOUNCEMENT' &&
              !hasPdfAttachment(item) &&
              !parseCelebrationMeta(item.message || '')
          )
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        if (!cancelled) setAnnouncement(latest || null);
      } catch {
        if (!cancelled) setAnnouncement(null);
      }
    }

    loadAnnouncement();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Respect "reduce motion" ----------
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // ---------- Build the slides ----------
  const slides = useMemo(() => {
    const list = [];

    // 1. Monthly Magazine (always present, keeps its empty state)
    list.push({
      key: 'magazine',
      tone: 'blue',
      Icon: BookOpen,
      badge: 'Monthly Magazine',
      badgeMeta: magazine?.month || '',
      title: magazine?.title || 'No Magazine Published Yet',
      desc:
        magazine?.description ||
        'HR or Manager Can Publish The Company Magazine Here For Everyone to Read.',
      cover: { type: 'poster', src: MAGAZINE_PHOTO, alt: 'Monthly magazine cover', tilt: -2 },
      cta: magazine?.documentUrl
        ? {
            label: 'Read This Edition',
            icon: ExternalLink,
            onClick: () => openPdfDocument(magazine.documentUrl),
          }
        : null,
    });

    // 2. Employee of the Month (always present, keeps its empty state)
    const hasEom = Boolean(employeeOfMonth?.employeeName);
    list.push({
      key: 'eom',
      tone: 'warm',
      Icon: Award,
      badge: 'Employee of The Month',
      badgeMeta: formatMonth(employeeOfMonth?.month),
      title: hasEom ? capitalizeName(employeeOfMonth.employeeName) : 'Not Selected Yet',
      desc: hasEom
        ? [employeeOfMonth.designation, employeeOfMonth.department].filter(Boolean).join(' · ')
        : 'HR or Manager Can Recognise an Outstanding Employee Here.',
      quote: hasEom ? employeeOfMonth.message : '',
      cover: {
        type: 'poster',
        src: employeeOfMonth?.photoUrl || EOM_PHOTO,
        fallback: EOM_PHOTO,
        alt: employeeOfMonth?.employeeName || 'Employee of the month',
        tilt: 2,
      },
      tag: hasEom ? { icon: Star, label: 'Recognised' } : null,
    });

    // 3. Latest announcement
    if (announcement) {
      list.push({
        key: 'announcement',
        tone: 'violet',
        Icon: Megaphone,
        badge: 'Latest Announcement',
        badgeMeta: announcement.createdAt
          ? new Date(announcement.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })
          : '',
        title: announcement.title,
        desc: announcement.message,
        clampDesc: true,
        cover: { type: 'icon' },
        cta: {
          label: 'View Announcements',
          icon: ChevronRight,
          onClick: () => nav(role === 'EMPLOYEE' ? '/notifications' : '/announcements'),
        },
      });
    }

    // 4. Next holiday
    if (upcomingHoliday?.holidayName) {
      list.push({
        key: 'holiday',
        tone: 'teal',
        Icon: CalendarDays,
        badge: 'Upcoming Holiday',
        badgeMeta: whenLabel(daysFromToday(upcomingHoliday.holidayDate)),
        title: upcomingHoliday.holidayName,
        desc: formatLongDate(upcomingHoliday.holidayDate),
        cover: { type: 'icon' },
        cta: {
          label: 'View Holiday List',
          icon: ChevronRight,
          onClick: () => nav('/holidays'),
        },
      });
    }

    // 5. Next birthday
    const nextBirthday = [...birthdayEmployees]
      .filter((person) => person?.name)
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0))[0];
    if (nextBirthday) {
      const days = nextBirthday.daysUntil ?? 0;
      list.push({
        key: 'birthday',
        tone: 'pink',
        Icon: PartyPopper,
        badge: days === 0 ? "Today's Birthday" : 'Upcoming Birthday',
        badgeMeta: whenLabel(days),
        title: capitalizeName(nextBirthday.name),
        desc:
          days === 0
            ? 'Wish them a great day on the Celebration Wall.'
            : 'Get ready to wish them on the Celebration Wall.',
        cover: { type: 'icon' },
        cta: {
          label: 'Open Celebration Wall',
          icon: ChevronRight,
          onClick: () => nav('/celebrations'),
        },
      });
    }

    // 6. Role-based leave card
    if (!leaveLoading) {
      if (role === 'MANAGER') {
        list.push({
          key: 'approvals',
          tone: 'orange',
          Icon: ClipboardCheck,
          badge: 'Leave Approvals',
          badgeMeta: '',
          title: `${pendingApprovals} Pending ${pendingApprovals === 1 ? 'Request' : 'Requests'}`,
          desc: pendingApprovals
            ? 'Your team is waiting for a decision.'
            : 'You are all caught up. Nothing is waiting for you.',
          cover: { type: 'icon' },
          cta: {
            label: 'Review Requests',
            icon: ChevronRight,
            onClick: () => nav('/leave-approvals'),
          },
        });
      } else if (leaveSummary) {
        list.push({
          key: 'leave',
          tone: 'orange',
          Icon: CalendarDays,
          badge: 'My Leave Balance',
          badgeMeta: '',
          title: `${leaveSummary.left} ${leaveSummary.left === 1 ? 'Day' : 'Days'} Left`,
          desc: `${leaveSummary.taken} ${leaveSummary.taken === 1 ? 'day' : 'days'} taken so far.`,
          cover: { type: 'icon' },
          cta: {
            label: 'Apply Leave',
            icon: ChevronRight,
            onClick: () => nav('/leave'),
          },
        });
      }
    }

    return list;
  }, [
    role,
    magazine,
    employeeOfMonth,
    announcement,
    upcomingHoliday,
    birthdayEmployees,
    leaveSummary,
    leaveLoading,
    pendingApprovals,
    nav,
  ]);

  const count = slides.length;
  const active = Math.min(index, count - 1);

  const goTo = useCallback(
    (next) => setIndex(((next % count) + count) % count),
    [count]
  );
  const goNext = useCallback(() => goTo(active + 1), [goTo, active]);
  const goPrev = useCallback(() => goTo(active - 1), [goTo, active]);

  // ---------- Handlers ----------
  const handleProgressEnd = (event) => {
    // Only the progress bar's own animation should advance the slide.
    if (event.animationName === 'hcProgress' && count > 1) goNext();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goNext();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goPrev();
    }
  };

  const handleTouchStart = (event) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta < 0) goNext();
    else goPrev();
  };

  const autoPlay = !reducedMotion && count > 1;

  return (
    <section
      className="hc-root"
      aria-roledescription="carousel"
      aria-label="Dashboard highlights"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="hc-track" style={{ transform: `translateX(-${active * 100}%)` }}>
        {slides.map((slide, i) => {
          const isActive = i === active;
          const CtaIcon = slide.cta?.icon;
          const BadgeIcon = slide.Icon;
          const TagIcon = slide.tag?.icon;

          return (
            <article
              key={slide.key}
              className={`hc-slide hc-slide--${slide.tone}${isActive ? ' is-active' : ''}`}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!isActive}
              inert={!isActive}
            >
              {slide.cover.type === 'poster' ? (
                <div className="hc-cover hc-cover--poster" style={{ '--tilt': `${slide.cover.tilt}deg` }}>
                  <img
                    src={slide.cover.src}
                    alt={slide.cover.alt}
                    onError={(e) => {
                      if (slide.cover.fallback && e.currentTarget.src !== slide.cover.fallback) {
                        e.currentTarget.src = slide.cover.fallback;
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="hc-cover hc-cover--icon" aria-hidden="true">
                  <span className="hc-ring hc-ring--1" />
                  <span className="hc-ring hc-ring--2" />
                  <BadgeIcon size={52} strokeWidth={1.6} />
                </div>
              )}

              <div className="hc-content">
                <div className="hc-badge">
                  <BadgeIcon size={15} />
                  {slide.badge}
                  {slide.badgeMeta && <span className="hc-dot" />}
                  {slide.badgeMeta}
                </div>
                <h3 className="hc-title">{slide.title}</h3>
                {slide.desc && (
                  <p className={`hc-desc${slide.clampDesc ? ' hc-desc--clamp' : ''}`}>{slide.desc}</p>
                )}
                {slide.quote && <p className="hc-quote">{slide.quote}</p>}
                {slide.tag && (
                  <span className="hc-tag">
                    <TagIcon size={14} fill="#f59e0b" color="#f59e0b" /> {slide.tag.label}
                  </span>
                )}
                {slide.cta && (
                  <button type="button" className="hc-cta" onClick={slide.cta.onClick}>
                    {slide.cta.label} <CtaIcon size={14} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <div className="hc-controls">
          <button type="button" className="hc-arrow" onClick={goPrev} aria-label="Previous highlight">
            <ChevronLeft size={16} />
          </button>
          <div className="hc-dots" role="tablist" aria-label="Choose highlight">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Show ${slide.badge}`}
                className={`hc-dotbtn${i === active ? ' is-active' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <button type="button" className="hc-arrow" onClick={goNext} aria-label="Next highlight">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {autoPlay && (
        <div className="hc-progress" aria-hidden="true">
          <span
            key={active}
            className="hc-progress-fill"
            style={{
              animationDuration: `${SLIDE_SECONDS}s`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
            onAnimationEnd={handleProgressEnd}
          />
        </div>
      )}
    </section>
  );
}