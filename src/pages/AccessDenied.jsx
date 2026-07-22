import {Link} from 'react-router-dom'; import {ShieldAlert} from 'lucide-react';
export default function AccessDenied(){return <div className="panel empty-state"><ShieldAlert size={46}/><h2>Access denied</h2><p>This page is not available for your role.</p><Link className="btn btn-primary" to="/dashboard">Back to dashboard</Link></div>}
