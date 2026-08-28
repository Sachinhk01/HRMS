import { Award, BookOpen, ChevronRight, ExternalLink, Star } from 'lucide-react';
import { capitalizeName } from '../utils/formatName';
import { openPdfDocument } from '../utils/openPdf';

const MAGAZINE_PHOTO = "https://images.unsplash.com/photo-1769794371055-54436b54577e?fm=jpg&q=80&w=800&auto=format&fit=crop";
const EOM_PHOTO = "https://images.unsplash.com/photo-1758691737584-a8f17fb34475?fm=jpg&q=80&w=800&auto=format&fit=crop";

// The Employee of the Month form saves month as a raw "YYYY-MM" string
// (native <input type="month"> value) — display it the same way the
// magazine card shows its date, e.g. "July 2026", not the raw value.
function formatMonth(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  }
  return value;
}

/**
 * Highlight cards — real photography instead of illustrations:
 *  - Monthly Magazine: soft blue card with a magazine/reading photo
 *  - Employee of the Month: warm cream card with a team celebration photo
 * Both use a split layout — photo on one side, content on the other.
 */
export default function HighlightCards({ magazine, employeeOfMonth }) {
  return (
    <div className="highlights-grid">
      {/* ---------- Monthly Magazine ---------- */}
      <article className="hl-card hl-magazine">
        <div className="hl-magazine-cover">
          <img src={MAGAZINE_PHOTO} alt="Monthly magazine cover" />
        </div>
        <div className="hl-content">
          <div className="hl-badge hl-badge--blue">
            <BookOpen size={15} /> Monthly Magazine
            {magazine?.month && <span className="hl-badge-dot" />}
            {magazine?.month && magazine.month}
          </div>
          <h3 className="hl-title">{magazine?.title || 'No Magazine Published Yet'}</h3>
          <p className="hl-desc">{magazine?.description || 'HR or Manager Can Publish The Company Magazine Here For Everyone to Read.'}</p>
          {magazine?.documentUrl && (
            <button
              type="button"
              className="hl-cta"
              onClick={() => openPdfDocument(magazine.documentUrl)}
            >
              Read This Edition <ExternalLink size={14} />
            </button>
          )}
        </div>
      </article>

      {/* ---------- Employee of the Month ---------- */}
      <article className="hl-card hl-employee">
        <div className="hl-eom-cover">
          <img
            src={employeeOfMonth?.photoUrl || EOM_PHOTO}
            alt={employeeOfMonth?.employeeName || 'Employee of the month'}
            onError={(e) => { e.currentTarget.src = EOM_PHOTO; }}
          />
        </div>
        <div className="hl-content">
          <div className="hl-badge hl-badge--warm">
            <Award size={15} /> Employee of The Month
            {employeeOfMonth?.month && <span className="hl-badge-dot" />}
            {formatMonth(employeeOfMonth?.month)}
          </div>
          {employeeOfMonth?.employeeName ? (
            <>
              <h3 className="hl-title hl-title--emp">{capitalizeName(employeeOfMonth.employeeName)}</h3>
              {(employeeOfMonth.designation || employeeOfMonth.department) && (
                <p className="hl-desc">{[employeeOfMonth.designation, employeeOfMonth.department].filter(Boolean).join(' · ')}</p>
              )}
              {employeeOfMonth.message && (
                <p className="hl-quote">{employeeOfMonth.message}</p>
              )}
              <span className="hl-stars"><Star size={14} fill="#f59e0b" color="#f59e0b" /> Recognised</span>
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