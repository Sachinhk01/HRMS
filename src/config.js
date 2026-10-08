export const ROLES = {
  EMPLOYEE: 'EMPLOYEE',
  HR_ADMIN: 'HR_ADMIN',
  MANAGER: 'MANAGER',
  SUPER_ADMIN: 'SUPER_ADMIN',
  PAYROLL_ADMIN: 'PAYROLL_ADMIN',
  CLIENT: 'CLIENT',
};


export const ROLE_MENUS = {
  EMPLOYEE: [
    ['/dashboard', 'Dashboard'],
    ['/attendance', 'Attendance'],
    ['/leave', 'Leave'],
    ['/regularization', 'Regularization'],
    ['/celebrations', 'Celebration Wall'],
    ['/announcements', 'Announcements'],
    ['/events', 'Events'],
    ['/payroll', 'Salary'],
    ['/profile', 'Profile'],
  ],

  HR_ADMIN: [
    ['/dashboard', 'Dashboard'],
    ['/employees', 'Employees'],
    ['/attendance', 'Attendance'],
    ['/leave', 'Leave'],
    ['/regularization', 'Regularization'],
    ['/celebrations', 'Celebration Wall'],
    ['/announcements', 'Announcements'],
    ['/events', 'Events'],
    ['/payroll', 'Salary Management'],
    ['/form16', 'Form 16'],
    ['/reports', 'Reports'],
    ['/profile', 'Profile'],
  ],

  MANAGER: [
    ['/dashboard', 'Dashboard'],
    ['/leave', 'My Leave'],
    ['/leave-approvals', 'Leave Approvals'],
    ['/regularization', 'My Regularization'],
    ['/regularization-approvals', 'Regularization Approvals'],
    ['/attendance', 'Attendance'],
    ['/celebrations', 'Celebration Wall'],
    ['/announcements', 'Announcements'],
    ['/events', 'Events'],
    ['/performance', 'Performance'],
    ['/employees', 'Employees'],
    ['/reports', 'Reports'],
    ['/payroll', 'My Salary'],
    ['/profile', 'Profile'],
  ],

  SUPER_ADMIN: [
    ['/dashboard', 'Dashboard'],
    ['/employees', 'Employees'],
    ['/attendance', 'Attendance'],
    ['/regularization', 'Regularization'],
    ['/celebrations', 'Celebration Wall'],
    ['/announcements', 'Announcements'],
    ['/events', 'Events'],
    ['/leave', 'Leave'],
    ['/leave-approvals', 'Leave Approvals'],
    ['/performance', 'Performance'],
    ['/candidates', 'Candidates'],
    ['/form16', 'Form 16'],
    ['/profile', 'Profile'],
  ],

  PAYROLL_ADMIN: [
    ['/dashboard', 'Dashboard'],
    ['/profile', 'Profile'],
  ],

  CLIENT: [
    ['/dashboard', 'Dashboard'],
    ['/profile', 'Profile'],
  ],
};

export const ROUTE_ROLES = {
  '/dashboard': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
    'PAYROLL_ADMIN',
    'CLIENT',
  ],

  '/attendance': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],

  '/profile': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
    'PAYROLL_ADMIN',
    'CLIENT',
  ],

  '/leave': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],

  '/celebrations': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],

  '/employees': [
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],

  '/announcements': [
    'HR_ADMIN',
    'SUPER_ADMIN',
    'EMPLOYEE',
    'MANAGER'
  ],

  '/events': [
    'HR_ADMIN',
    'SUPER_ADMIN',
    'EMPLOYEE',
    'MANAGER'
  ],

  // Backend: hasAnyRole('HR_ADMIN','MANAGER') — any other role gets a 403.
  '/reports': [
    'HR_ADMIN',
    'MANAGER',
  ],

  '/leave-approvals': [
    'MANAGER',
    'SUPER_ADMIN',
  ],
  '/regularization': [
    'EMPLOYEE',
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],
  '/regularization-approvals': [
    'MANAGER',
  ],
  // Managers are employees too: this route renders their own read-only salary view.
  '/payroll': ['EMPLOYEE', 'HR_ADMIN', 'MANAGER'],
  '/form16': ['HR_ADMIN', 'SUPER_ADMIN'],
  '/settings': [
    'HR_ADMIN',
    'MANAGER',
    'SUPER_ADMIN',
  ],
  '/notifications': [
  'EMPLOYEE',
  'HR_ADMIN',
  'MANAGER',
  'SUPER_ADMIN',
  'PAYROLL_ADMIN',
  'CLIENT',
],




  '/performance': [
    'MANAGER',
    'SUPER_ADMIN',
  ],
  '/holidays': ['EMPLOYEE', 'HR_ADMIN', 'MANAGER', 'SUPER_ADMIN'],
  '/candidates': [
    'MANAGER',
    'SUPER_ADMIN',
  ],
};