import { Award, BookOpen, ExternalLink, Star } from 'lucide-react';
import magazineIllustration from '../assets/illustrations/book.png';
import employeeIllustration from '../assets/illustrations/cup.png';

function formatMagazineLabel(month) {
  if (!month) return 'No edition yet';
  const [year, mon] = month.split('-');
  const date = new Date(`${year}-${mon}-01T00:00:00`);
  return isNaN(date.getTime()) ? month : date.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

export default function HighlightCards({ magazine, employeeOfMonth }) {
  return (
    <div className="highlights-grid">
      <article className="hl-card hl-magazine">
        <div className="hl-illustration hl-illustration--blue">
          <img src={magazineIllustration} alt="Magazine illustration" />
        </div>
        <div className="hl-content">
          <div className="hl-badge hl-badge--blue">
            <BookOpen size={15} /> Monthly Magazine
          </div>
          <h3 className="hl-title">{magazine?.title || 'No magazine published yet'}</h3>
          <p className="hl-desc">{magazine?.description || 'HR or Manager can publish the company magazine here for everyone to read.'}</p>
          <div className="hl-meta">
            {magazine?.month && <span className="hl-chip">{formatMagazineLabel(magazine.month)}</span>}
            {magazine?.documentUrl && (
              <a className="hl-link" href={magazine.documentUrl} target="_blank" rel="noreferrer">
                Open magazine <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
      </article>

      <article className="hl-card hl-employee">
        <div className="hl-illustration hl-illustration--warm">
          <img src={employeeIllustration} alt="Employee of the month illustration" />
        </div>
        <div className="hl-content">
          <div className="hl-badge hl-badge--warm">
            <Award size={15} /> Employee of the Month
          </div>
          {employeeOfMonth?.employeeName ? (
            <>
              <div className="hl-emp-row">
                {employeeOfMonth.photoUrl ? (
                  <img className="hl-emp-photo" src={employeeOfMonth.photoUrl} alt={employeeOfMonth.employeeName} />
                ) : (
                  <div className="hl-emp-avatar">
                    {employeeOfMonth.employeeName.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                  </div>
                )}
                <div>
                  <h3 className="hl-title hl-title--emp">{employeeOfMonth.employeeName}</h3>
                  <p className="hl-desc">{employeeOfMonth.designation || employeeOfMonth.department || 'Recognised team member'}</p>
                </div>
              </div>
              {employeeOfMonth.message && <p className="hl-quote">“{employeeOfMonth.message}”</p>}
              <div className="hl-meta">
                {employeeOfMonth.month && <span className="hl-chip hl-chip--warm">{formatMagazineLabel(employeeOfMonth.month)}</span>}
                <span className="hl-stars"><Star size={14} fill="#f59e0b" color="#f59e0b" /> Recognition</span>
              </div>
            </>
          ) : (
            <>
              <h3 className="hl-title">Employee of the Month</h3>
              <p className="hl-desc">No employee has been selected for this month yet. Recognition will appear here once announced.</p>
            </>
          )}
        </div>
      </article>
    </div>
  );
}
