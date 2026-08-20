import { Award, BookOpen, ChevronRight, ExternalLink, Star } from 'lucide-react';
import { capitalizeName } from '../utils/formatName';

const MAGAZINE_PHOTO = "https://images.unsplash.com/photo-1769794371055-54436b54577e?fm=jpg&q=80&w=800&auto=format&fit=crop";
const EOM_PHOTO = "https://images.unsplash.com/photo-1758691737584-a8f17fb34475?fm=jpg&q=80&w=800&auto=format&fit=crop";

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
        <div className="hl-illustration hl-illustration--blue">
          <img src={magazine?.coverUrl || MAGAZINE_PHOTO} alt="Monthly magazine" />
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
          <img src={employeeOfMonth?.photoUrl || EOM_PHOTO} alt="Employee of the month" />
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