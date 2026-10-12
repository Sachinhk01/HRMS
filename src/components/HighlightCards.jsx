import MagazineCard from './MagazineCard';
import EmployeeOfMonthCard from './EmployeeOfMonthCard';

/**
 * Highlight cards on the dashboard:
 *  - Monthly Magazine: navy card with a 3D book cover
 *  - Employee of the Month: dark gold "awards night" card
 */
export default function HighlightCards({ magazine, employeeOfMonth }) {
  return (
    <div className="highlights-grid">
      <MagazineCard magazine={magazine} />
      <EmployeeOfMonthCard employeeOfMonth={employeeOfMonth} />
    </div>
  );
}
