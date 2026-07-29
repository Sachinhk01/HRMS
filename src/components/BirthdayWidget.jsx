import { Cake, ChevronRight } from 'lucide-react';

function getInitials(name = '') {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function isBirthdayToday(dateOfBirth) {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  return dob.getDate() === today.getDate() && dob.getMonth() === today.getMonth();
}

export default function BirthdayWidget({ employees = [], onViewAll }) {
  const todaysBirthdays = employees.filter((e) => isBirthdayToday(e.dateOfBirth || e.dob));

  return (
    <section
      className="panel birthday-widget"
      onClick={onViewAll}
      role={onViewAll ? 'button' : undefined}
      tabIndex={onViewAll ? 0 : undefined}
    >
      <div className="panel-title">
        <h2><Cake size={18} color="#f59e0b" /> Celebration Wall &mdash; Today&apos;s Birthdays</h2>
        {onViewAll && (
          <span className="view-all-affordance">View all <ChevronRight size={15} /></span>
        )}
      </div>

      {todaysBirthdays.length === 0 ? (
        <div className="birthday-empty">
          <Cake size={16} />
          No birthdays today. Check back tomorrow!
        </div>
      ) : (
        <div className="birthday-list">
          {todaysBirthdays.map((emp) => (
            <div className="birthday-row" key={emp.id}>
              <div className="birthday-avatar">{getInitials(emp.name)}</div>
              <div className="birthday-copy">
                <strong>{emp.name}</strong>
                <span>{emp.designation || emp.department || 'Team member'}</span>
              </div>
              <span className="birthday-emoji">🎂</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
