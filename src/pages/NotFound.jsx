import { Link } from 'react-router-dom';
export default function NotFound(){return <div className="not-found"><strong>404</strong><h1>Page not found</h1><p>The page you requested does not exist.</p><Link className="btn btn-primary" to="/dashboard">Back to dashboard</Link></div>}
