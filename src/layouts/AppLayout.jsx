import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopBar from '../components/TopBar';

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const pageName = pathname.split('/').filter(Boolean)[0] || 'dashboard';

  return (
    <div className="app-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="main-shell">
        <TopBar onMenu={() => setOpen(true)} />
        <main className={`main-content page-${pageName}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
