export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-header fade-up">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
