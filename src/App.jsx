import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ROUTE_ROLES } from './config';
import AppLayout from './layouts/AppLayout';
import LandingHero from './pages/LandingHero';
import EmployeeLogin from './pages/EmployeeLogin';
import ManagerLogin from './pages/ManagerLogin';
import HRLogin from './pages/HRLogin';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import CelebrationWall from './pages/CelebrationWall';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import Performance from './pages/Performance';
import NotFound from './pages/NotFound';
import Holidays from './pages/Holidays';
import Employees from './pages/Employees';
import Candidates from './pages/Candidates';
import LeaveApprovals from './pages/LeaveApprovals';
import Announcements from './pages/Announcements';
import Events from './pages/Events';
import AccessDenied from './pages/AccessDenied';
import Notifications from './pages/Notifications';

function ProtectedRoute() {
  const { user } = useAuth();
  return user ? <AppLayout /> : <Navigate to="/login" replace />;
}

function RoleRoute({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const allowed = ROUTE_ROLES[pathname] || [];
  const userRole = user?.role || user?.roles?.[0];

  return allowed.includes(userRole)
    ? children
    : <Navigate to="/access-denied" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <EmployeeLogin />}
      />
      <Route
        path="/login/manager"
        element={user ? <Navigate to="/dashboard" replace /> : <ManagerLogin />}
      />
      <Route
        path="/login/hr-admin"
        element={user ? <Navigate to="/dashboard" replace /> : <HRLogin />}
      />
      <Route
        path="/forgot-password"
        element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<RoleRoute><Dashboard /></RoleRoute>} />
        <Route path="/attendance" element={<RoleRoute><Attendance /></RoleRoute>} />
        <Route path="/holidays" element={<RoleRoute><Holidays /></RoleRoute>} />
        <Route path="/leave" element={<RoleRoute><Leave /></RoleRoute>} />
        <Route path="/celebrations" element={<RoleRoute><CelebrationWall /></RoleRoute>} />
        <Route path="/profile" element={<RoleRoute><Profile /></RoleRoute>} />
        <Route path="/employees" element={<RoleRoute><Employees /></RoleRoute>} />
        <Route path="/candidates" element={<RoleRoute><Candidates /></RoleRoute>} />
        <Route path="/leave-approvals" element={<RoleRoute><LeaveApprovals /></RoleRoute>} />
        <Route path="/announcements" element={<RoleRoute><Announcements /></RoleRoute>} />
        <Route path="/events" element={<RoleRoute><Events /></RoleRoute>} />
        <Route path="/reports" element={<RoleRoute><Reports /></RoleRoute>} />
        <Route path="/performance" element={<RoleRoute><Performance /></RoleRoute>} />
        <Route path="/notifications" element={<RoleRoute><Notifications /></RoleRoute>} />
        <Route path="/access-denied" element={<AccessDenied />} />
      </Route>

      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingHero />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}