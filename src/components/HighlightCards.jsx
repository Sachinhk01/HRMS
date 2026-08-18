import { Award, BookOpen, ChevronRight, ExternalLink, Star } from 'lucide-react';
import { capitalizeName } from '../utils/FormatName';

/**
 * Redesigned highlight cards inspired by the reference image:
 *  - Monthly Magazine: soft blue card with a kite/dove illustration motif
 *  - Employee of the Month: warm cream card with a trophy/medal motif
 * Both use a split layout — illustration on one side, content on the other.
 */
export default function HighlightCards({ magazine, employeeOfMonth }) {
  return (
    <div className="highlights-grid">
      {/* ---------- Monthly Magazine ---------- */}
      <article className="hl-card hl-magazine">
        <div className="hl-illustration hl-illustration--blue">
          {/* Kite + dove motif (inline SVG, no external asset) */}
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="100" cy="100" r="80" fill="#dbeafe" opacity="0.5" />
            {/* Kite */}
            <path d="M70 40 L120 90 L70 140 L20 90 Z" fill="#60a5fa" opacity="0.9" />
            <path d="M70 40 L120 90 L70 140 L20 90 Z" stroke="#2563eb" strokeWidth="2" />
            <line x1="70" y1="40" x2="70" y2="140" stroke="#2563eb" strokeWidth="1.5" />
            <line x1="20" y1="90" x2="120" y2="90" stroke="#2563eb" strokeWidth="1.5" />
            {/* Kite tail */}
            <path d="M70 140 Q75 155 65 165 Q60 175 70 180" stroke="#2563eb" strokeWidth="2" fill="none" />
            <circle cx="68" cy="172" r="3" fill="#f59e0b" />
            {/* Dove */}
            <path d="M120 60 Q140 50 155 62 Q150 55 145 50 Q160 48 165 58 Q170 65 160 70 Q145 75 130 72 Q120 68 120 60 Z" fill="#fff" stroke="#1e40af" strokeWidth="1.5" />
            <circle cx="160" cy="58" r="1.5" fill="#1e40af" />
            {/* Clouds */}
            <ellipse cx="150" cy="120" rx="18" ry="7" fill="#bfdbfe" opacity="0.7" />
            <ellipse cx="40" cy="150" rx="14" ry="6" fill="#bfdbfe" opacity="0.6" />
          </svg>
        </div>
        <div className="hl-content">
          <div className="hl-badge hl-badge--blue">
            <BookOpen size={15} /> Monthly Magazine
          </div>
          <h3 className="hl-title">{magazine?.title || 'No Magazine Published Yet'}</h3>
          <p className="hl-desc">{magazine?.description || 'HR or Manager Can Publish The Company Magazine Here For Everyone to Read.'}</p>
          <div className="hl-meta">
            {magazine?.month && <span className="hl-chip">{magazine.month}</span>}
            {magazine?.documentUrl && (
              <a className="hl-link" href={magazine.documentUrl} target="_blank" rel="noreferrer">
                Open Magazine <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </article>

      {/* ---------- Employee of the Month ---------- */}
      <article className="hl-card hl-employee">
        <div className="hl-illustration hl-illustration--warm">
          {/* Trophy + stars motif */}
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="100" cy="100" r="80" fill="#fef3c7" opacity="0.5" />
            {/* Trophy cup */}
            <path d="M75 55 L125 55 L122 95 Q120 110 100 112 Q80 110 78 95 Z" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
            <path d="M75 60 Q60 62 60 75 Q60 85 75 82" stroke="#d97706" strokeWidth="2" fill="none" />
            <path d="M125 60 Q140 62 140 75 Q140 85 125 82" stroke="#d97706" strokeWidth="2" fill="none" />
            {/* Trophy base */}
            <rect x="92" y="112" width="16" height="10" fill="#d97706" />
            <rect x="82" y="122" width="36" height="8" rx="2" fill="#b45309" />
            {/* Stars */}
            <path d="M55 50 l3 6 6 1 -4.5 4.5 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4.5 6 -1 z" fill="#fde68a" stroke="#d97706" strokeWidth="1" />
            <path d="M150 45 l2.5 5 5 0.8 -3.8 3.7 0.9 5 -4.6 -2.5 -4.6 2.5 0.9 -5 -3.8 -3.7 5 -0.8 z" fill="#fde68a" stroke="#d97706" strokeWidth="1" />
            {/* Sparkle */}
            <circle cx="100" cy="80" r="3" fill="#fff" opacity="0.8" />
          </svg>
        </div>
        <div className="hl-content">
          <div className="hl-badge hl-badge--warm">
            <Award size={15} /> Employee of The Month
          </div>
          {employeeOfMonth?.employeeName ? (
            <>
              <div className="hl-emp-row">
                <div className="hl-emp-avatar">
                  {employeeOfMonth.employeeName.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h3 className="hl-title hl-title--emp">{capitalizeName(employeeOfMonth.employeeName)}</h3>
                  <p className="hl-desc">{employeeOfMonth.designation || employeeOfMonth.department || employeeOfMonth.message}</p>
                </div>
              </div>
              <div className="hl-meta">
                {employeeOfMonth.month && <span className="hl-chip hl-chip--warm">{employeeOfMonth.month}</span>}
                <span className="hl-stars"><Star size={14} fill="#f59e0b" color="#f59e0b" /> Recognised</span>
              </div>
            </>
          ) : (
            <>
              <h3 className="hl-title">Not Selected Yet</h3>
              <p className="hl-desc">HR or Manager Can Recognise an Outstanding Employee Here.</p>
            </>
          )}
        </div>
      </article>
    </div>
  );
}