import { Link } from 'react-router-dom';
import logo from '../assets/hourlyrecruit-logo-clean.png';

export default function Logo({ size = 34, linkTo = '/' }) {
  return (
    <Link to={linkTo} className="hrms-logo-link" aria-label="Go to homepage">
      <img
        src={logo}
        alt="MyHourly HRMS"
        style={{ height: size, width: 'auto', display: 'block' }}
      />
    </Link>
  );
}