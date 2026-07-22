import logo from '../assets/hourlyrecruit-logo-clean.png';

export default function Logo({ compact = false }) {
  return (
    <div className={`brand brand-image ${compact ? 'brand--compact' : ''}`}>
      <img
        src={logo}
        alt="HourlyRecruit Tech Labs"
        style={{ height: compact ? 42 : 54, width: 'auto' }}
      />
    </div>
  );
}